import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cn, sortPosts } from "@/lib/utils";
import { posts } from "#site/content";
import Link from "next/link";
import { PostItem } from "@/components/post-item";
import BoidsVisualization from "@/components/BoidsVisualization";

export default function Home() {
  const latestPosts = sortPosts(posts).slice(0, 5);
  return (
    <>
      {/* Hero section with boids background */}
      <div className="relative">
        {/* Boids background visualization */}
        <div className="absolute inset-0 w-full overflow-hidden" style={{ height: "calc(100% + 4rem)" }}>
          <BoidsVisualization 
            width={2200}
            height={600}
            numBoids={1000}
            backgroundColor="transparent"
            boidColor="currentColor"
            boidRadius={4}
            depth={100}
            shapeWeight={1.3}
            shapeType="splines"
            splineChangeInterval={4000}
            shapeComplexity={5}
            showTrails={true}
            trailOpacity={0.65}
            className="w-full h-full max-w-[1200px] mx-auto text-foreground opacity-60"
          />
        </div>
        
        {/* Title content above boids */}
        <section className="relative z-10 space-y-6 pb-8 pt-6 md:pb-8 md:mt-10 lg:pt-16 lg:pb-16">
          <div className="container flex flex-col gap-4">
            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black">
              {siteConfig.author}
            </h1>
            <p className="text-muted-foreground sm:text-2xl">
              {siteConfig.description}
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Link
                href="/articles"
                className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-fit")}
              >
                Articles
              </Link>
              <Link
                href={siteConfig.links.github}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  buttonVariants({ variant: "glassmorphism", size: "lg" }),
                  "w-full sm:w-fit",
                )}
              >
                GitHub
              </Link>
              <Link
                href="/contact"
                rel="noreferrer"
                className={cn(
                  buttonVariants({ variant: "glassmorphism", size: "lg" }),
                  "w-full sm:w-fit",
                )}
              >
                Contact
              </Link>
              <Link
                href="/about"
                rel="noreferrer"
                className={cn(
                  buttonVariants({ variant: "glassmorphism", size: "lg" }),
                  "w-full sm:w-fit",
                )}
              >
                Resume
              </Link>
            </div>
          </div>
        </section>
        
        {/* Spacer to ensure the boids have room to move */}
        <div className="h-40 md:h-52 lg:h-64"></div>
      </div>
      
      <section className="container py-4 lg:py-6 flex flex-col space-y-2">
        <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black">
          Latest Articles
        </h2>
        <ul className="flex flex-col">
          {latestPosts.map(
            (post) =>
              post.published && (
                <li
                  key={post.slug}
                  className="first:border-t first:border-border"
                >
                  <PostItem
                    slug={post.slug}
                    title={post.title}
                    description={post.description}
                    date={post.date}
                    tags={post.tags}
                  />
                </li>
              ),
          )}
        </ul>
      </section>
    </>
  );
}
