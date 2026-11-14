
import { useState } from "react";

const COURT_OPTIONS = [
  "Supreme Court",
  "Court of Appeal",
  "High Court",
  "Civil Appellate High Court",
  "Commercial High Court",
  "District Court",
  "Magistrate's Court",
  "Primary Court",
  "Circuit Magistrate's Court",
  "Labour Tribunal",
];

const LOCATION_OPTIONS = [
  "Colombo",
  "Battaramulla",
  "Kaduwela",
  "Homagama",
  "Mount Lavinia",
  "Gampaha",
  "Negombo",
  "Wattala",
  "Panadura",
  "Kalutara",
  "Avissawella",
  "Kandy",
  "Matale",
  "Dambulla",
  "Nawalapitiya",
  "Nuwara Eliya",
  "Hatton",
  "Galle",
  "Matara",
  "Tangalle",
  "Hambantota",
  "Badulla",
  "Bandarawela",
  "Monaragala",
  "Ratnapura",
  "Balangoda",
  "Kegalle",
  "Kurunegala",
  "Kuliyapitiya",
  "Chilaw",
  "Puttalam",
  "Anuradhapura",
  "Polonnaruwa",
  "Trincomalee",
  "Batticaloa",
  "Ampara",
  "Kalmunai",
  "Jaffna",
  "Kilinochchi",
  "Vavuniya",
  "Mannar",
  "Mullaitivu",
];

function SelectOrType({
  label,
  placeholder,
  otherPlaceholder,
  options,
  value,
  onChange,
  readOnly,
  spacing,
}) {
  const [otherSelected, setOtherSelected] = useState(false);

  const isOther =
    otherSelected || Boolean(value && !options.includes(value));

  const fieldClass = `ade2-control${
    spacing ? " ade2-location" : ""
  }`;

  if (readOnly) {
    return (
      <input
        className={fieldClass}
        aria-label={label}
        value={value || ""}
        readOnly
      />
    );
  }

  return (
    <>
      <select
        className={fieldClass}
        aria-label={label}
        value={isOther ? "__other__" : value || ""}
        onChange={(event) => {
          const selected = event.target.value;
          const custom = selected === "__other__";

          setOtherSelected(custom);
          onChange(custom ? "" : selected);
        }}
      >
        <option value="" disabled>
          {placeholder}
        </option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}

        <option value="__other__">Other</option>
      </select>

      {isOther && (
        <input
          type="text"
          className="ade2-control ade2-location"
          aria-label={`Specify ${label}`}
          placeholder={otherPlaceholder}
          value={value || ""}
          onChange={(event) =>
            onChange(event.target.value)
          }
        />
      )}
    </>
  );
}

export default function SriLankaCourtFields({
  court,
  location,
  onCourtChange,
  onLocationChange,
  readOnly = false,
}) {
  return (
    <>
      <SelectOrType
        label="Court name"
        placeholder="Select Court"
        otherPlaceholder="Enter court name..."
        options={COURT_OPTIONS}
        value={court}
        onChange={onCourtChange}
        readOnly={readOnly}
      />

      <SelectOrType
        label="Court location"
        placeholder="Select Court Location"
        otherPlaceholder="Enter Sri Lankan court town..."
        options={LOCATION_OPTIONS}
        value={location}
        onChange={onLocationChange}
        readOnly={readOnly}
        spacing
      />
    </>
  );
}
