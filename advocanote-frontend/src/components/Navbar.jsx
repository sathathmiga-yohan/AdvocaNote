import { useState } from "react";

const navItems = [
  { label: "Home", href: "#home" },
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="adv-navbar">
      <div className="adv-container adv-navbar-inner">

        {/* LOGO */}

        <a
          href="#home"
          className="adv-brand"
          onClick={() => setMenuOpen(false)}
        >
          <img
            src="/images/landing-page/advocanote-logo.png"
            alt="AdvocaNote"
            className="adv-brand-logo"
          />

          <div className="adv-brand-info">
            <span className="adv-brand-name">
              Advoca<span>Note</span>
            </span>

            <span className="adv-brand-subtitle">
              AI Smart Legal Diary
            </span>
          </div>
        </a>

        {/* MOBILE MENU BUTTON */}

        <button
          type="button"
          className="adv-menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>

        {/* NAVIGATION */}

        <nav
          className={`adv-nav-links ${
            menuOpen ? "adv-nav-open" : ""
          }`}
          aria-label="Main navigation"
        >
          {navItems.map((item, index) => (
            <a
              key={item.label}
              href={item.href}
              className={
                index === 0
                  ? "adv-nav-active"
                  : index >= 4
                  ? "adv-nav-light"
                  : ""
              }
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </a>
          ))}

          <div className="adv-mobile-actions">
            <a href="/login">Login</a>
            <a href="/register">Get Started</a>
          </div>
        </nav>

        {/* NAVBAR BUTTONS */}

        <div className="adv-navbar-actions">
          <a href="/login" className="adv-login-btn">
            Login
          </a>

          <a
            href="/register"
            className="adv-nav-get-started"
          >
            Get Started
          </a>
        </div>

      </div>
    </header>
  );
}