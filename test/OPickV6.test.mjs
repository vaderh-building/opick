import hre from "hardhat";
const { ethers } = hre;
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("OPickV6", function () {
  async function deployFixture() {
    const [owner, creator, userA, userB, userC, amplifier, treasury] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    const Factory = await ethers.getContractFactory("OPickV6Factory");
    const factory = await Factory.deploy(await usdc.getAddress(), treasury.address);

    // Mint USDC to users (1000 each)
    const amt = ethers.parseUnits("1000", 6);
    for (const u of [creator, userA, userB, userC]) {
      await usdc.mint(u.address, amt);
    }

    return { usdc, factory, owner, creator, userA, userB, userC, amplifier, treasury };
  }

  async function createMarket(factory, creator, usdc, cap) {
    const capUSDC = ethers.parseUnits(String(cap), 6);
    const tx = await factory.connect(creator).createMarket(
      "Who is the GOAT?", "Messi", "Ronaldo", "Sports", capUSDC
    );
    const receipt = await tx.wait();
    const event = receipt.logs.find(l => {
      try { return factory.interface.parseLog(l)?.name === "V6MarketCreated"; } catch { return false; }
    });
    const parsed = factory.interface.parseLog(event);
    const marketAddr = parsed.args.market;
    const Market = await ethers.getContractFactory("OPickV6Market");
    const market = Market.attach(marketAddr);
    // Approve market for all users
    const users = [creator, ...(arguments.length > 4 ? Array.from(arguments).slice(4) : [])];
    return market;
  }

  async function approveAll(usdc, market, users) {
    const max = ethers.parseUnits("10000", 6);
    for (const u of users) {
      await usdc.connect(u).approve(await market.getAddress(), max);
    }
  }

  describe("Factory", function () {
    it("creates a V6 market with correct params", async function () {
      const { factory, creator, usdc } = await loadFixture(deployFixture);
      const cap = ethers.parseUnits("100", 6);
      const tx = await factory.connect(creator).createMarket("Test?", "A", "B", "Tech", cap);
      const receipt = await tx.wait();

      expect(await factory.totalMarkets()).to.equal(1);
      const addr = (await factory.getMarkets(0, 1))[0];
      const Market = await ethers.getContractFactory("OPickV6Market");
      const m = Market.attach(addr);
      expect(await m.topic()).to.equal("Test?");
      expect(await m.sideAName()).to.equal("A");
      expect(await m.sideBName()).to.equal("B");
      expect(await m.volumeCap()).to.equal(cap);
      expect(await m.creator()).to.equal(creator.address);
      expect(Number(await m.state())).to.equal(0); // OPEN
    });

    it("rejects zero volume cap", async function () {
      const { factory, creator } = await loadFixture(deployFixture);
      await expect(
        factory.connect(creator).createMarket("Q", "A", "B", "C", 0)
      ).to.be.revertedWith("Cap must be positive");
    });
  });

  describe("Betting", function () {
    it("accepts bets on both sides", async function () {
      const { factory, creator, userA, userB, usdc } = await loadFixture(deployFixture);
      const cap = ethers.parseUnits("100", 6);
      await factory.connect(creator).createMarket("Q", "A", "B", "C", cap);
      const addr = (await factory.getMarkets(0, 1))[0];
      const Market = await ethers.getContractFactory("OPickV6Market");
      const market = Market.attach(addr);
      await approveAll(usdc, market, [userA, userB]);

      const bet = ethers.parseUnits("20", 6);
      await market.connect(userA).buy(true, bet, ethers.ZeroAddress);
      await market.connect(userB).buy(false, bet, ethers.ZeroAddress);

      expect(await market.totalA()).to.equal(bet);
      expect(await market.totalB()).to.equal(bet);
      expect(await market.depositsA(userA.address)).to.equal(bet);
      expect(await market.depositsB(userB.address)).to.equal(bet);
    });

    it("rejects bets exceeding volume cap", async function () {
      const { factory, creator, userA, usdc } = await loadFixture(deployFixture);
      const cap = ethers.parseUnits("50", 6);
      await factory.connect(creator).createMarket("Q", "A", "B", "C", cap);
      const addr = (await factory.getMarkets(0, 1))[0];
      const Market = await ethers.getContractFactory("OPickV6Market");
      const market = Market.attach(addr);
      await approveAll(usdc, market, [userA]);

      const overBet = ethers.parseUnits("51", 6);
      await expect(
        market.connect(userA).buy(true, overBet, ethers.ZeroAddress)
      ).to.be.revertedWith("Exceeds volume cap");
    });

    it("tracks amplifier earnings for referred bets", async function () {
      const { factory, creator, userA, amplifier, usdc } = await loadFixture(deployFixture);
      const cap = ethers.parseUnits("100", 6);
      await factory.connect(creator).createMarket("Q", "A", "B", "C", cap);
      const addr = (await factory.getMarkets(0, 1))[0];
      const Market = await ethers.getContractFactory("OPickV6Market");
      const market = Market.attach(addr);
      await approveAll(usdc, market, [userA]);

      const bet = ethers.parseUnits("30", 6);
      await market.connect(userA).buy(true, bet, amplifier.address);

      // 1% of 30 USDC = 0.30 USDC = 300000
      const earnings = await market.amplifierEarnings(amplifier.address);
      expect(earnings).to.be.closeTo(ethers.parseUnits("0.30", 6), 10);
    });

    it("routes amplifier fee to platform when no referrer", async function () {
      const { factory, creator, userA, usdc } = await loadFixture(deployFixture);
      const cap = ethers.parseUnits("100", 6);
      await factory.connect(creator).createMarket("Q", "A", "B", "C", cap);
      const addr = (await factory.getMarkets(0, 1))[0];
      const Market = await ethers.getContractFactory("OPickV6Market");
      const market = Market.attach(addr);
      await approveAll(usdc, market, [userA]);

      const bet = ethers.parseUnits("30", 6);
      await market.connect(userA).buy(true, bet, ethers.ZeroAddress);

      // Platform gets 1% + 1% (amplifier rerouted) = 2% of 30 = 0.60
      const platformFee = await market.pendingPlatformFee();
      expect(platformFee).to.be.closeTo(ethers.parseUnits("0.60", 6), 10);
    });
  });

  describe("Resolution", function () {
    it("auto-resolves when cap is reached, majority wins", async function () {
      const { factory, creator, userA, userB, userC, usdc, treasury } = await loadFixture(deployFixture);
      const cap = ethers.parseUnits("100", 6);
      await factory.connect(creator).createMarket("Q", "A", "B", "C", cap);
      const addr = (await factory.getMarkets(0, 1))[0];
      const Market = await ethers.getContractFactory("OPickV6Market");
      const market = Market.attach(addr);
      await approveAll(usdc, market, [userA, userB, userC]);

      // A: 70, B: 30 = 100 total = cap reached
      await market.connect(userA).buy(true, ethers.parseUnits("20", 6), ethers.ZeroAddress);
      await market.connect(userB).buy(false, ethers.parseUnits("30", 6), ethers.ZeroAddress);
      // This bet hits cap and triggers auto-resolve
      await market.connect(userC).buy(true, ethers.parseUnits("50", 6), ethers.ZeroAddress);

      expect(Number(await market.state())).to.equal(1); // CLOSED_RESOLVED
      expect(await market.winningSide()).to.equal(true); // Side A wins
    });

    it("winners can claim proportional share", async function () {
      const { factory, creator, userA, userB, userC, usdc, treasury } = await loadFixture(deployFixture);
      const cap = ethers.parseUnits("100", 6);
      await factory.connect(creator).createMarket("Q", "A", "B", "C", cap);
      const addr = (await factory.getMarkets(0, 1))[0];
      const Market = await ethers.getContractFactory("OPickV6Market");
      const market = Market.attach(addr);
      await approveAll(usdc, market, [userA, userB, userC]);

      await market.connect(userA).buy(true, ethers.parseUnits("20", 6), ethers.ZeroAddress);
      await market.connect(userB).buy(false, ethers.parseUnits("30", 6), ethers.ZeroAddress);
      await market.connect(userC).buy(true, ethers.parseUnits("50", 6), ethers.ZeroAddress);

      const balBefore = await usdc.balanceOf(userA.address);
      await market.connect(userA).claim();
      const balAfter = await usdc.balanceOf(userA.address);
      const payout = balAfter - balBefore;

      // User A has 20/70 of winning side. Pool after 3% fees = 97.
      // Payout = (20/70) * 97 = ~27.71 USDC
      expect(payout).to.be.closeTo(ethers.parseUnits("27.71", 6), ethers.parseUnits("0.1", 6));
    });

    it("losers get nothing on resolved market", async function () {
      const { factory, creator, userA, userB, userC, usdc } = await loadFixture(deployFixture);
      const cap = ethers.parseUnits("100", 6);
      await factory.connect(creator).createMarket("Q", "A", "B", "C", cap);
      const addr = (await factory.getMarkets(0, 1))[0];
      const Market = await ethers.getContractFactory("OPickV6Market");
      const market = Market.attach(addr);
      await approveAll(usdc, market, [userA, userB, userC]);

      await market.connect(userA).buy(true, ethers.parseUnits("20", 6), ethers.ZeroAddress);
      await market.connect(userB).buy(false, ethers.parseUnits("30", 6), ethers.ZeroAddress);
      await market.connect(userC).buy(true, ethers.parseUnits("50", 6), ethers.ZeroAddress);

      await expect(market.connect(userB).claim()).to.be.revertedWith("Nothing to claim");
    });

    it("prevents double claim", async function () {
      const { factory, creator, userA, userB, userC, usdc } = await loadFixture(deployFixture);
      const cap = ethers.parseUnits("100", 6);
      await factory.connect(creator).createMarket("Q", "A", "B", "C", cap);
      const addr = (await factory.getMarkets(0, 1))[0];
      const Market = await ethers.getContractFactory("OPickV6Market");
      const market = Market.attach(addr);
      await approveAll(usdc, market, [userA, userB, userC]);

      await market.connect(userA).buy(true, ethers.parseUnits("20", 6), ethers.ZeroAddress);
      await market.connect(userB).buy(false, ethers.parseUnits("30", 6), ethers.ZeroAddress);
      await market.connect(userC).buy(true, ethers.parseUnits("50", 6), ethers.ZeroAddress);

      await market.connect(userA).claim();
      await expect(market.connect(userA).claim()).to.be.revertedWith("Already claimed");
    });

    it("ties result in refund", async function () {
      const { factory, creator, userA, userB, usdc } = await loadFixture(deployFixture);
      const cap = ethers.parseUnits("100", 6);
      await factory.connect(creator).createMarket("Q", "A", "B", "C", cap);
      const addr = (await factory.getMarkets(0, 1))[0];
      const Market = await ethers.getContractFactory("OPickV6Market");
      const market = Market.attach(addr);
      await approveAll(usdc, market, [userA, userB]);

      await market.connect(userA).buy(true, ethers.parseUnits("50", 6), ethers.ZeroAddress);
      // This hits cap with tied sides
      await market.connect(userB).buy(false, ethers.parseUnits("50", 6), ethers.ZeroAddress);

      expect(Number(await market.state())).to.equal(2); // CLOSED_REFUNDED
    });
  });

  describe("Refund", function () {
    it("refunds after 30 days via checkAndResolve", async function () {
      const { factory, creator, userA, usdc } = await loadFixture(deployFixture);
      const cap = ethers.parseUnits("100", 6);
      await factory.connect(creator).createMarket("Q", "A", "B", "C", cap);
      const addr = (await factory.getMarkets(0, 1))[0];
      const Market = await ethers.getContractFactory("OPickV6Market");
      const market = Market.attach(addr);
      await approveAll(usdc, market, [userA]);

      await market.connect(userA).buy(true, ethers.parseUnits("20", 6), ethers.ZeroAddress);

      // Fast forward 30 days
      await time.increase(30 * 24 * 60 * 60);
      await market.checkAndResolve();

      expect(Number(await market.state())).to.equal(2); // CLOSED_REFUNDED

      const balBefore = await usdc.balanceOf(userA.address);
      await market.connect(userA).claim();
      const balAfter = await usdc.balanceOf(userA.address);
      // Full refund
      expect(balAfter - balBefore).to.equal(ethers.parseUnits("20", 6));
    });

    it("creator can close and trigger refund", async function () {
      const { factory, creator, userA, usdc } = await loadFixture(deployFixture);
      const cap = ethers.parseUnits("100", 6);
      await factory.connect(creator).createMarket("Q", "A", "B", "C", cap);
      const addr = (await factory.getMarkets(0, 1))[0];
      const Market = await ethers.getContractFactory("OPickV6Market");
      const market = Market.attach(addr);
      await approveAll(usdc, market, [userA]);

      await market.connect(userA).buy(true, ethers.parseUnits("20", 6), ethers.ZeroAddress);
      await market.connect(creator).close();

      expect(Number(await market.state())).to.equal(2); // CLOSED_REFUNDED

      const balBefore = await usdc.balanceOf(userA.address);
      await market.connect(userA).claim();
      const balAfter = await usdc.balanceOf(userA.address);
      expect(balAfter - balBefore).to.equal(ethers.parseUnits("20", 6));
    });

    it("non-creator cannot close market", async function () {
      const { factory, creator, userA, usdc } = await loadFixture(deployFixture);
      const cap = ethers.parseUnits("100", 6);
      await factory.connect(creator).createMarket("Q", "A", "B", "C", cap);
      const addr = (await factory.getMarkets(0, 1))[0];
      const Market = await ethers.getContractFactory("OPickV6Market");
      const market = Market.attach(addr);

      await expect(market.connect(userA).close()).to.be.revertedWith("Only creator");
    });

    it("refund returns full amount, no fees taken", async function () {
      const { factory, creator, userA, userB, usdc } = await loadFixture(deployFixture);
      const cap = ethers.parseUnits("100", 6);
      await factory.connect(creator).createMarket("Q", "A", "B", "C", cap);
      const addr = (await factory.getMarkets(0, 1))[0];
      const Market = await ethers.getContractFactory("OPickV6Market");
      const market = Market.attach(addr);
      await approveAll(usdc, market, [userA, userB]);

      const betA = ethers.parseUnits("30", 6);
      const betB = ethers.parseUnits("20", 6);
      await market.connect(userA).buy(true, betA, ethers.ZeroAddress);
      await market.connect(userB).buy(false, betB, ethers.ZeroAddress);

      await market.connect(creator).close();

      // Both get exact deposits back
      const balA1 = await usdc.balanceOf(userA.address);
      await market.connect(userA).claim();
      expect((await usdc.balanceOf(userA.address)) - balA1).to.equal(betA);

      const balB1 = await usdc.balanceOf(userB.address);
      await market.connect(userB).claim();
      expect((await usdc.balanceOf(userB.address)) - balB1).to.equal(betB);
    });
  });

  describe("Fee structure", function () {
    it("3% fees distributed correctly on resolution", async function () {
      const { factory, creator, userA, userB, userC, usdc, treasury } = await loadFixture(deployFixture);
      const cap = ethers.parseUnits("100", 6);
      await factory.connect(creator).createMarket("Q", "A", "B", "C", cap);
      const addr = (await factory.getMarkets(0, 1))[0];
      const Market = await ethers.getContractFactory("OPickV6Market");
      const market = Market.attach(addr);
      await approveAll(usdc, market, [userA, userB, userC]);

      const treasuryBefore = await usdc.balanceOf(treasury.address);
      const creatorBefore = await usdc.balanceOf(creator.address);

      // All unreferred, so amplifier fees go to platform
      await market.connect(userA).buy(true, ethers.parseUnits("20", 6), ethers.ZeroAddress);
      await market.connect(userB).buy(false, ethers.parseUnits("30", 6), ethers.ZeroAddress);
      await market.connect(userC).buy(true, ethers.parseUnits("50", 6), ethers.ZeroAddress);

      // Pool = 100. Fees = 3% = 3 USDC.
      // Platform gets 1% + 1% (no amplifier) = 2 USDC.
      // Creator gets 1% = 1 USDC.
      const treasuryGain = (await usdc.balanceOf(treasury.address)) - treasuryBefore;
      const creatorGain = (await usdc.balanceOf(creator.address)) - creatorBefore;

      expect(treasuryGain).to.be.closeTo(ethers.parseUnits("2.0", 6), ethers.parseUnits("0.01", 6));
      expect(creatorGain).to.be.closeTo(ethers.parseUnits("1.0", 6), ethers.parseUnits("0.01", 6));
    });

    it("amplifier can claim fees after resolution", async function () {
      const { factory, creator, userA, userB, userC, amplifier, usdc } = await loadFixture(deployFixture);
      const cap = ethers.parseUnits("100", 6);
      await factory.connect(creator).createMarket("Q", "A", "B", "C", cap);
      const addr = (await factory.getMarkets(0, 1))[0];
      const Market = await ethers.getContractFactory("OPickV6Market");
      const market = Market.attach(addr);
      await approveAll(usdc, market, [userA, userB, userC]);

      // User B referred by amplifier
      await market.connect(userA).buy(true, ethers.parseUnits("20", 6), ethers.ZeroAddress);
      await market.connect(userB).buy(false, ethers.parseUnits("30", 6), amplifier.address);
      await market.connect(userC).buy(true, ethers.parseUnits("50", 6), ethers.ZeroAddress);

      // Amplifier earned 1% of B's $30 = $0.30
      const balBefore = await usdc.balanceOf(amplifier.address);
      await market.connect(amplifier).claimAmplifierFees();
      const gain = (await usdc.balanceOf(amplifier.address)) - balBefore;
      expect(gain).to.be.closeTo(ethers.parseUnits("0.30", 6), 10);
    });

    it("amplifier cannot claim on refunded market", async function () {
      const { factory, creator, userA, amplifier, usdc } = await loadFixture(deployFixture);
      const cap = ethers.parseUnits("100", 6);
      await factory.connect(creator).createMarket("Q", "A", "B", "C", cap);
      const addr = (await factory.getMarkets(0, 1))[0];
      const Market = await ethers.getContractFactory("OPickV6Market");
      const market = Market.attach(addr);
      await approveAll(usdc, market, [userA]);

      await market.connect(userA).buy(true, ethers.parseUnits("20", 6), amplifier.address);
      await market.connect(creator).close(); // refund

      await expect(market.connect(amplifier).claimAmplifierFees())
        .to.be.revertedWith("Not resolved");
    });
  });

  describe("No sell function", function () {
    it("V6 market has no sell function", async function () {
      const { factory, creator } = await loadFixture(deployFixture);
      const cap = ethers.parseUnits("100", 6);
      await factory.connect(creator).createMarket("Q", "A", "B", "C", cap);
      const addr = (await factory.getMarkets(0, 1))[0];
      const Market = await ethers.getContractFactory("OPickV6Market");
      const market = Market.attach(addr);

      // Verify no sell functions exist
      expect(market.sellA).to.be.undefined;
      expect(market.sellB).to.be.undefined;
      expect(market.sell).to.be.undefined;
    });
  });
});
