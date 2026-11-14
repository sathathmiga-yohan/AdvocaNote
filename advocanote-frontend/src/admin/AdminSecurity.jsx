
import { Link } from "react-router-dom";
import {
  Settings,
  SlidersHorizontal,
  ServerCog,
  ArrowLeft,
} from "lucide-react";

import "./AdminSettings.css";

export default function AdminSettings() {
  return (
    <div className="amset-page">
      <header className="amset-heading">
        <h1>System Settings</h1>
        <p>
          Configure application preferences and system settings.
        </p>
      </header>

      <section className="amset-card">
        <div className="amset-icon">
          <Settings size={38} strokeWidth={1.5} />
        </div>

        <span className="amset-label">
          APPLICATION CONFIGURATION
        </span>

        <h2>Coming Soon</h2>

        <p>
          System Settings are currently under
          development. Soon, administrators will
          be able to manage application settings,
          feature access and system configurations.
        </p>

        <div className="amset-features">
          <span>
            <SlidersHorizontal size={17} />
            Feature Settings
          </span>

          <span>
            <ServerCog size={17} />
            System Configuration
          </span>
        </div>

        <Link to="/admin" className="amset-back">
          <ArrowLeft size={17} />
          Back to Dashboard
        </Link>
      </section>
    </div>
  );
}
