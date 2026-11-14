
import React from "react";
import { BrainCircuit, Sparkles } from "lucide-react";

export default function AISuggestions() {
  return (
    <div
      style={{
        minHeight: "100%",
        padding: "32px",
        background: "#faf9f5",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <header style={{ marginBottom: "30px" }}>
        <h1
          style={{
            fontFamily: "Georgia, serif",
            fontSize: "32px",
            color: "#003e2e",
            margin: "0 0 10px",
          }}
        >
          AI Suggestions
        </h1>

        <p style={{ color: "#64746e", margin: 0 }}>
          Your intelligent legal practice assistant
        </p>
      </header>

      <div
        style={{
          maxWidth: "700px",
          margin: "60px auto",
          padding: "45px 25px",
          background: "#ffffff",
          border: "1px solid #e6e8e0",
          borderRadius: "18px",
          textAlign: "center",
        }}
      >
        <BrainCircuit
          size={54}
          color="#005244"
          style={{ marginBottom: "15px" }}
        />

        <h2
          style={{
            fontFamily: "Georgia, serif",
            color: "#003e2e",
            fontSize: "27px",
          }}
        >
          AI Suggestions Coming Soon
        </h2>

        <p
          style={{
            color: "#64746e",
            lineHeight: "1.7",
            maxWidth: "440px",
            margin: "15px auto 25px",
          }}
        >
          Intelligent suggestions for cases,
          hearings, tasks, and deadlines
          will be available here soon.
        </p>

        <Sparkles size={25} color="#c69c61" />
      </div>
    </div>
  );
}
