"use client";

import { useEffect, useRef } from "react";

export function ErrorSummary({
  errors,
  submitCount,
}: {
  errors: { path: string; question: string; href: string }[];
  submitCount: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (submitCount > 0 && errors.length > 0) ref.current?.focus();
  }, [submitCount, errors.length]);

  if (errors.length === 0) return null;

  return (
    <div className="error-summary" role="alert" tabIndex={-1} ref={ref}>
      <h2>Check these answers</h2>
      <ul>
        {errors.map((error) => (
          <li key={error.path}>
            <a href={error.href}>{error.question}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
