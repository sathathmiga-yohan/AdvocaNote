
import { Link } from "react-router-dom";
import {
  Headset,
  MessageSquare,
  CircleCheck,
  ArrowLeft,
} from "lucide-react";

import "./AdminSupport.css";

export default function AdminSupport() {
  return (
    <div className="amsp-page">
      <header className="amsp-heading">
        <h1>Support & Feedback</h1>
        <p>
          Manage lawyer support requests and feedback.
        </p>
      </header>

      <section className="amsp-card">
        <div className="amsp-icon">
          <Headset size={38} strokeWidth={1.5} />
        </div>

        <span className="amsp-label">
          CUSTOMER SUPPORT MANAGEMENT
        </span>

        <h2>Coming Soon</h2>

        <p>
          Support and Feedback Management is under
          development. Soon, administrators will be
          able to review lawyer complaints, respond
          to support tickets and resolve issues.
        </p>

        <div className="amsp-features">
          <span>
            <MessageSquare size={17} />
            Support Tickets
          </span>

          <span>
            <CircleCheck size={17} />
            Issue Resolution
          </span>
        </div>

        <Link to="/admin" className="amsp-back">
          <ArrowLeft size={17} />
          Back to Dashboard
        </Link>
      </section>
    </div>
  );
}
