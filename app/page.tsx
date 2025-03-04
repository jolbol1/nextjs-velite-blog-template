import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cn, sortPosts } from "@/lib/utils";
import { posts } from "#site/content";
import Link from "next/link";
import { PostItem } from "@/components/post-item";
import AnimatedTitle from "@/components/animatedTitle";
import StaticTitle from "@/components/staticTitle";

export default function Home() {
  const latestPosts = sortPosts(posts).slice(0, 5);
  return (
    <>
      <section className="space-y-6 pb-8 pt-6 md:pb-12 md:mt-20 lg:py-32">
        <div className="container flex flex-col gap-4 text-center">
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-balance">
            {siteConfig.author}
          </h1>
          <p className="max-w-[42rem] mx-auto text-muted-foreground sm:text-xl text-balance">
            {siteConfig.description}
          </p>
          <div className="flex flex-col gap-4 justify-center sm:flex-row">
            <Link
              href="/articles"
              className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-fit")}
            >
              View Articles
            </Link>
            <Link
              href={siteConfig.links.github}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full sm:w-fit",
              )}
            >
              GitHub
            </Link>
            <Link
              href="/contact"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full sm:w-fit",
              )}
            >
              Contact
            </Link>
            <Link
              href="/about"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full sm:w-fit",
              )}
            >
              Resume
            </Link>
          </div>
        </div>
      </section>
      <section className="container max-w-4xl py-4 lg:py-6 flex flex-col space-y-2 mt-0">
        <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-center">
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
