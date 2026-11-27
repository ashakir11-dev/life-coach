import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <h1>That page is not available</h1>
      <p className="lede">The question may not be part of this copy of Dayfolio.</p>
      <p>
        <Link href="/">Back to Explore</Link>
      </p>
    </>
  );
}
