import s from './LegalPage.module.css';

export default function RiskPage() {
  return (
    <div className={s.page}>
      <h1 className={s.title}>Risk Disclosure</h1>
      <p className={s.updated}>Last updated: April 2026</p>

      <div className={s.section}>
        <p className={s.body}>
          Trading on OPick involves risk of financial loss. Please read this disclosure carefully
          before using the protocol.
        </p>
      </div>

      <div className={s.section}>
        <h2 className={s.heading}>Market risk</h2>
        <p className={s.body}>
          Prices on OPick are determined by market participants and can be volatile.
          The value of your positions can decrease as well as increase.
          Past performance does not indicate future results.
        </p>
      </div>

      <div className={s.section}>
        <h2 className={s.heading}>Loss of funds</h2>
        <p className={s.body}>
          You may lose part or all of the money you invest on OPick. Only trade with money
          you can afford to lose. Do not invest money you need for essential expenses.
        </p>
      </div>

      <div className={s.section}>
        <h2 className={s.heading}>Smart contract risk</h2>
        <p className={s.body}>
          OPick's smart contracts have not been formally audited. While the contracts have been
          tested extensively, bugs or vulnerabilities may exist. Smart contract risk is inherent
          to all decentralized protocols.
        </p>
      </div>

      <div className={s.section}>
        <h2 className={s.heading}>Irreversibility</h2>
        <p className={s.body}>
          Blockchain transactions are irreversible. Once a trade is confirmed, it cannot be undone.
          Verify all transaction details before confirming.
        </p>
      </div>

      <div className={s.section}>
        <h2 className={s.heading}>No recourse</h2>
        <p className={s.body}>
          OPick is not responsible for losses due to user error, smart contract bugs, network
          congestion, or adverse market conditions. You use the protocol at your own risk.
        </p>
      </div>
    </div>
  );
}
