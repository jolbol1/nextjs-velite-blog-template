"use client";

import { siteConfig } from "@/config/site";
import { motion } from "framer-motion";
import { execOnce } from "next/dist/shared/lib/utils";

const title = siteConfig.author;

const AnimatedTitle = () => {
  return (
    <h1 className=" moving-title text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-balance">
      {title.split("").map((char, i) => (
        <motion.span
          key={i}
          initial={{ scaleX: 1, fontVariationSettings: `"wght" 400, "slnt" 0` }}
          animate={{
            scaleX: [1, 1.3, 0.8, 1], // Stretch wide, then squish narrow
            fontVariationSettings: [
              `"wght" 400, "slnt" 0`,
              `"wght" 400, "slnt" 5`, // Bold and slanted when stretched
              `"wght" 400, "slnt" -5`, // Light and backward slanted when squished
              `"wght" 400, "slnt" 0`,
            ],
          }}
          transition={{
            duration: 1.2,
            repeat: 1,
            repeatType: "mirror",
            delay: i * 0.3, // Creates a wave effect
          }}
          style={{ display: "inline-block" }}
        >
          {char}
        </motion.span>
      ))}
    </h1>
  );
};

export default AnimatedTitle;
