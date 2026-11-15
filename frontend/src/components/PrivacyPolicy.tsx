import { PRIVACY_CONTACT, PRIVACY_LAST_UPDATED } from "../config";

/**
 * The privacy policy page (opened with #privacy).
 *
 * It describes what the app does today. Update it BEFORE adding anything that
 * handles personal data differently: analytics, ads, accounts, cookies.
 */
export function PrivacyPolicy() {
  return (
    <article className="panel legal">
      <a className="link-btn" href="#">
        ← Back to the puzzles
      </a>
      <h1 className="legal-title">Privacy Policy</h1>
      <p className="legal-meta">Last updated: {PRIVACY_LAST_UPDATED}</p>

      <p>
        AI Mini Crossword is a small daily puzzle game. We built it to need as little information
        about you as possible: there are no accounts, and we do not ask for your name or email.
      </p>

      <h2>What we handle, and why</h2>
      <ul>
        <li>
          <strong>Your IP address.</strong> Our server uses it to count how many new puzzles were
          made from your connection today, so the daily limit works. The count is kept in the
          server's memory and cleared at the end of the day.
        </li>
        <li>
          <strong>The themes you type.</strong> When you ask for a puzzle about a theme, the theme
          text is sent to our AI provider to write the puzzle. A puzzle made for a theme is shared
          with other players who ask for the same theme that day. Please do not type personal
          information into the theme box.
        </li>
        <li>
          <strong>Technical logs.</strong> Our hosting provider records standard server logs, such
          as IP address, time and the page requested, to keep the service running and secure.
        </li>
      </ul>

      <h2>What we do not do</h2>
      <ul>
        <li>No accounts, and no advertising or tracking cookies.</li>
        <li>We do not sell your information.</li>
        <li>Your answers and solving times stay in your browser and are not sent to us.</li>
      </ul>

      <h2>Who helps us run the app</h2>
      <ul>
        <li>
          <strong>Anthropic</strong> provides the AI model (Claude) that writes the puzzles. It
          receives the theme text.
        </li>
        <li>
          <strong>Render</strong> hosts the website and the server. It processes the technical
          logs.
        </li>
      </ul>
      <p>These providers may process data outside your country, including in the United States.</p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may have the right to ask what information we hold about
        you, and to have it corrected or deleted. Because we keep so little, there is usually
        nothing stored about you after the end of the day.
      </p>

      <h2>Children</h2>
      <p>The app is not directed at children under 13.</p>

      <h2>Changes</h2>
      <p>
        If we change how the app handles information, for example by adding usage statistics or
        ads, we will update this page first.
      </p>

      <h2>Contact</h2>
      <p>
        {PRIVACY_CONTACT ? (
          <>
            Questions about this policy: <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>
          </>
        ) : (
          "A contact address will be added here before launch."
        )}
      </p>
    </article>
  );
}
