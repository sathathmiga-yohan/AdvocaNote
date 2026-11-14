
import { Link } from "react-router-dom";
import {
  Bell,
  Send,
  Clock3,
  ArrowLeft,
} from "lucide-react";

import "./AdminNotifications.css";

export default function AdminNotifications() {
  return (
    <div className="amn-page">
      <header className="amn-heading">
        <h1>Notifications</h1>
        <p>
          Manage announcements and system notifications.
        </p>
      </header>

      <section className="amn-card">
        <div className="amn-icon">
          <Bell size={38} strokeWidth={1.5} />
        </div>

        <span className="amn-label">
          SYSTEM COMMUNICATION
        </span>

        <h2>Coming Soon</h2>

        <p>
          Notification Management is currently under
          development. Soon, administrators will be
          able to publish announcements, schedule
          notifications and review delivery history.
        </p>

        <div className="amn-features">
          <span>
            <Send size={17} />
            Announcements
          </span>

          <span>
            <Clock3 size={17} />
            Scheduled Notices
          </span>
        </div>

        <Link to="/admin" className="amn-back">
          <ArrowLeft size={17} />
          Back to Dashboard
        </Link>
      </section>
    </div>
  );
}
