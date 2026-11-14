
import { Link } from "react-router-dom";
import {
  Landmark,
  FolderOpen,
  ListChecks,
  ArrowLeft,
} from "lucide-react";

import "./AdminCourtSettings.css";

export default function AdminCourtSettings() {
  return (
    <div className="amc-page">
      <header className="amc-heading">
        <h1>Court & Case Settings</h1>
        <p>
          Configure courts, case types and case stages.
        </p>
      </header>

      <section className="amc-card">
        <div className="amc-icon">
          <Landmark size={38} strokeWidth={1.5} />
        </div>

        <span className="amc-label">
          LEGAL SYSTEM CONFIGURATION
        </span>

        <h2>Coming Soon</h2>

        <p>
          Court and Case Settings are under development.
          Soon, administrators will be able to maintain
          court information and case-related options
          used throughout AdvocaNote.
        </p>

        <div className="amc-features">
          <span>
            <Landmark size={17} />
            Court Management
          </span>

          <span>
            <FolderOpen size={17} />
            Case Types
          </span>

          <span>
            <ListChecks size={17} />
            Case Stages
          </span>
        </div>

        <Link to="/admin" className="amc-back">
          <ArrowLeft size={17} />
          Back to Dashboard
        </Link>
      </section>
    </div>
  );
}
