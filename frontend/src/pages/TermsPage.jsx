import s from './LegalPage.module.css';

export default function TermsPage() {
  return (
    <div className={s.page}>
      <h1 className={s.title}>Terms of Service</h1>
      <p className={s.updated}>Last updated: April 2026</p>

      <div className={s.section}>
        <h2 className={s.heading}>About OPick</h2>
        <p className={s.body}>
          OPick is an experimental opinion market protocol currently in beta.
          By using OPick, you agree to these terms. If you do not agree, do not use the protocol.
        </p>
      </div>

      <div className={s.section}>
        <h2 className={s.heading}>Eligibility</h2>
        <p className={s.body}>
          You must be at least 18 years old to use OPick. By using the protocol, you represent that you
          meet this requirement and that you are legally permitted to use such services in your jurisdiction.
        </p>
      </div>

      <div className={s.section}>
        <h2 className={s.heading}>Your responsibility</h2>
        <p className={s.body}>
          You are responsible for your own trading decisions. OPick does not provide investment advice,
          trading recommendations, or financial guidance of any kind. All trades are executed at your own risk.
        </p>
      </div>

      <div className={s.section}>
        <h2 className={s.heading}>Not a broker or exchange</h2>
        <p className={s.body}>
          OPick is not a registered broker, dealer, investment advisor, or exchange. The protocol
          facilitates peer-to-peer opinion trading through smart contracts on the Base blockchain.
        </p>
      </div>

      <div className={s.section}>
        <h2 className={s.heading}>Risk of loss</h2>
        <p className={s.body}>
          Trading on OPick involves risk of financial loss. Prices are determined by market participants
          and can be volatile. You may lose part or all of the money you put in. Only trade with money
          you can afford to lose.
        </p>
      </div>

      <div className={s.section}>
        <h2 className={s.heading}>Compliance</h2>
        <p className={s.body}>
          You are responsible for compliance with all applicable laws and regulations in your jurisdiction.
          OPick may restrict access from certain jurisdictions at any time.
        </p>
      </div>

      <div className={s.section}>
        <h2 className={s.heading}>No warranties</h2>
        <p className={s.body}>
          The protocol is provided "as is" without warranties of any kind, whether express or implied.
          OPick makes no guarantees about uptime, accuracy, or the performance of smart contracts.
        </p>
      </div>

      <div className={s.section}>
        <h2 className={s.heading}>Limitation of liability</h2>
        <p className={s.body}>
          To the maximum extent permitted by law, OPick and its contributors shall not be liable for
          any indirect, incidental, special, or consequential damages arising from your use of the protocol.
          This includes, but is not limited to, losses from trades, smart contract bugs, or service interruptions.
        </p>
      </div>

      <div className={s.section}>
        <h2 className={s.heading}>Changes to terms</h2>
        <p className={s.body}>
          OPick reserves the right to modify these terms at any time. Continued use of the protocol after
          changes constitutes acceptance of the updated terms. Material changes will be communicated through
          the platform.
        </p>
      </div>

      <div className={s.section}>
        <h2 className={s.heading}>Governing law</h2>
        <p className={s.body}>
          These terms are governed by the laws of the applicable jurisdiction. Any disputes shall be resolved
          through binding arbitration.
        </p>
      </div>
    </div>
  );
}
