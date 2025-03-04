"use client";

const title = "Variable Fonts!";

const StaticTitle = () => {
  return (
    <h1 className="text-5xl font-bold">
      {title.split("").map((char, i) => {
        // Stretch only lowercase a, o, u and uppercase O, U
        const shouldStretch = ["a", "o", "u", "O", "U"].includes(char);
        const variationSettings = shouldStretch
          ? `"wght" 400, "wdth" 150` // Stretch width to 150%
          : `"wght" 400, "wdth" 100`; // Keep others normal width

        return (
          <span
            key={i}
            style={{
              fontVariationSettings: variationSettings,
              display: "inline-block",
            }}
          >
            {char}
          </span>
        );
      })}
    </h1>
  );
};

export default StaticTitle;
