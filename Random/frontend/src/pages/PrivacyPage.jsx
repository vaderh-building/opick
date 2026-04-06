import s from './LegalPage.module.css';

export default function PrivacyPage() {
  return (
    <div className={s.page}>
      <h1 className={s.title}>Privacy Policy</h1>
      <p className={s.updated}>Last updated: April 2026</p>

      <div className={s.section}>
        <h2 className={s.heading}>What we collect</h2>
        <ul className={s.list}>
          <li>Email address (if you sign in with email or Google)</li>
          <li>Wallet address (created automatically or connected by you)</li>
          <li>Transaction data (trades, market creation, recorded on the public blockchain)</li>
          <li>Usage analytics (pages visited, features used)</li>
        </ul>
      </div>

      <div className={s.section}>
        <h2 className={s.heading}>Why we collect it</h2>
        <p className={s.body}>
          We collect data to provide the OPick service, improve the product, and communicate with you
          about your account. We do not sell your personal data to third parties.
        </p>
      </div>

      <div className={s.section}>
        <h2 className={s.heading}>Third parties</h2>
        <p className={s.body}>
          OPick uses the following third-party services:
        </p>
        <ul className={s.list}>
          <li>Privy for authentication and embedded wallets</li>
          <li>MoonPay and Coinbase for payment processing (when adding USDC)</li>
          <li>Base blockchain for recording transactions (public and permanent)</li>
        </ul>
        <p className={s.body}>
          Each third party has its own privacy policy. We encourage you to review them.
        </p>
      </div>

      <div className={s.section}>
        <h2 className={s.heading}>Blockchain data</h2>
        <p className={s.body}>
          All transactions on OPick are recorded on the Base blockchain. Blockchain records are
          public and permanent. Your wallet address and trading activity are visible to anyone.
          This cannot be changed or deleted.
        </p>
      </div>

      <div className={s.section}>
        <h2 className={s.heading}>Data retention</h2>
        <p className={s.body}>
          We retain your account data for as long as your account is active. If you request deletion,
          we will remove your email and profile data from our systems. Blockchain records are permanent
          and cannot be removed.
        </p>
      </div>

      <div className={s.section}>
        <h2 className={s.heading}>Cookies</h2>
        <p className={s.body}>
          OPick uses minimal, functional cookies for authentication and session management.
          We do not use advertising or tracking cookies.
        </p>
      </div>

      <div className={s.section}>
        <h2 className={s.heading}>Your rights</h2>
        <p className={s.body}>
          You can request deletion of your account data by contacting us at the address below.
          Note that blockchain records cannot be deleted.
        </p>
      </div>
    </div>
  );
}
