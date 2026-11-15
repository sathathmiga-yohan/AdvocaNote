
export default function StructuredLegalNotes({
  notes = [],
}) {
  const groups = new Map();

  for (const note of notes) {
    const heading =
      note?.category || "Hearing Summary";

    const point = note?.point?.trim();

    if (!point) continue;

    if (!groups.has(heading)) {
      groups.set(heading, []);
    }

    groups.get(heading).push(point);
  }

  return (
    <div className="an-structured-notes">
      {[...groups.entries()].map(
        ([heading, points]) => {
          const isSuggestion =
            heading.includes(
              "AI-Suggested"
            );

          return (
            <section
              key={heading}
              style={{
                marginBottom: 17,
                padding: "12px 14px",
                borderRadius: 9,
                background: isSuggestion
                  ? "#fff9e9"
                  : "#f7f9f7",
                border: isSuggestion
                  ? "1px solid #eadbb5"
                  : "1px solid #e5ebe5",
              }}
            >
              <h3
                style={{
                  margin: "0 0 9px",
                  fontSize: 14,
                  color: "#064835",
                  fontWeight: 600,
                }}
              >
                {heading}
              </h3>

              <ul
                style={{
                  paddingLeft: 20,
                  margin: 0,
                }}
              >
                {points.map(
                  (point, index) => (
                    <li
                      key={index}
                      style={{
                        marginBottom: 7,
                        lineHeight: 1.6,
                        fontSize: 13,
                        whiteSpace:
                          "pre-wrap",
                      }}
                    >
                      {point}
                    </li>
                  )
                )}
              </ul>

              {isSuggestion && (
                <small
                  style={{
                    color: "#826b37",
                  }}
                >
                  AI suggestions only.
                  Lawyer review required.
                </small>
              )}
            </section>
          );
        }
      )}
    </div>
  );
}
