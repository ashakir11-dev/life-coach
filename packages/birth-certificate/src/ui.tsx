"use client";

import { toolClassName } from "@dayfolio/tool-chrome";
import "@dayfolio/tool-chrome/styles.css";
import { useState } from "react";
import {
  evaluateBirthCertificate,
  type BirthEvaluation,
  type ChecklistTask,
} from "./evaluate";
import { birthCertificateManifest } from "./fixtures";
import { jurisdictions, type Jurisdiction } from "./jurisdictions";
import { TASK_KEYS, type BirthCertificateInput, type TaskKey } from "./schema";

export type BirthCertificateToolProps = {
  asOf: string;
  onSaveRequest?: (draft: { input: BirthCertificateInput; result: BirthEvaluation }) => void;
};

const TASK_DATE_LABEL: Record<TaskKey, string> = {
  "confirm-birth-jurisdiction":
    "Your target date (not an official deadline) for confirming the place",
  "open-official-destination":
    "Your target date (not an official deadline) for opening the official page",
  "follow-office-instructions":
    "Your target date (not an official deadline) for following the office instructions",
};

export function BirthCertificateTool({ asOf, onSaveRequest }: BirthCertificateToolProps) {
  const [birthChoice, setBirthChoice] = useState("");
  const [birthSplit, setBirthSplit] = useState("");
  const [homeChoice, setHomeChoice] = useState("");
  const [homeSplit, setHomeSplit] = useState("");
  const [tasks, setTasks] = useState<BirthCertificateInput["tasks"]>([]);
  const [saveNote, setSaveNote] = useState("");

  const birthJurisdictionId = selectedId(birthChoice, birthSplit);
  const residenceJurisdictionId = selectedId(homeChoice, homeSplit);
  const input: BirthCertificateInput = {
    ...(birthJurisdictionId ? { birthJurisdictionId } : {}),
    ...(residenceJurisdictionId ? { residenceJurisdictionId } : {}),
    ...(tasks && tasks.length > 0 ? { tasks } : {}),
  };
  const result = evaluateBirthCertificate(input, { asOf });
  const [shown, setShown] = useState(result.ok ? result : null);
  const [shownKey, setShownKey] = useState<string | null>(null);
  const resultKey = result.ok ? JSON.stringify(result) : null;
  if (resultKey && resultKey !== shownKey && result.ok) {
    setShown(result);
    setShownKey(resultKey);
  }
  const answer = result.ok ? result : shown;
  const stale = !result.ok && answer !== null;
  const places = placeOptions();

  function updateTask(key: TaskKey, patch: Partial<ChecklistTask>) {
    const current = new Map((tasks ?? []).map((task) => [task.key, task]));
    const previous = current.get(key);
    current.set(key, {
      key,
      owner: patch.owner ?? previous?.owner ?? "",
      status: patch.status ?? previous?.status ?? "waiting",
      ...(patch.targetDate || previous?.targetDate
        ? { targetDate: patch.targetDate ?? previous?.targetDate }
        : {}),
    });
    setTasks(TASK_KEYS.map((taskKey) => current.get(taskKey)).filter((task) => task !== undefined));
    setSaveNote("");
  }

  return (
    <article className={toolClassName}>
      <header>
        <h1>{birthCertificateManifest.question}</h1>
        <p className="df-lead">
          {answer?.educate.summary}{" "}
          {answer?.educate.whyJurisdiction}
        </p>
      </header>

      {answer?.destination ? (
        <section className="df-answer" aria-labelledby="birth-answer">
          <h2 id="birth-answer">Where to start</h2>
          {stale ? (
            <p className="df-status" role="status">
              This guidance uses the previous valid entries. Fix the checklist before relying on a new date or owner.
            </p>
          ) : null}
          <p>
            <a href={answer.destination.url}>{linkLabel(answer)}</a>
          </p>
          <p>{answer.destination.title}</p>
          <p className="df-note">
            Checked {answer.destination.review.checkedOn ?? "with the national page"}.{" "}
            {answer.destination.review.reviewExpiresOn
              ? `This office link is reviewed through ${answer.destination.review.reviewExpiresOn}.`
              : "This is the official lookup, not a copied list of fees or ID rules."}{" "}
            Local document requirements stay on that page. Correction owner:{" "}
            {answer.destination.review.correctionOwner}.
          </p>
          {answer.destination.withheld.length > 0 ? (
            <p className="df-note">Not included here: {answer.destination.withheld.join(", ")}.</p>
          ) : null}
          {answer.compare ? (
            <>
              <p>{answer.compare.narrative}</p>
              <div className="df-table-wrap">
                <table className="df-table">
                  <caption>{answer.compare.periodLabel}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Question</th>
                      {answer.compare.columns.map((column) => (
                        <th key={column.id} scope="col">
                          {column.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {answer.compare.rows.map((row) => (
                      <tr key={row.id}>
                        <th scope="row">{row.label}</th>
                        {answer.compare?.columns.map((column) => (
                          <td key={column.id}>{row.cells[column.id]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
          <p>
            Next step: {answer.nextStep.text}
            {answer.nextStep.owner ? ` Owner: ${answer.nextStep.owner}.` : " No owner yet."}
            {answer.nextStep.targetDate
              ? ` Your target date is ${answer.nextStep.targetDate}. ${answer.nextStep.targetDateMeaning}`
              : ""}
          </p>
          {answer.destination.alsoSee.length > 0 ? (
            <ul className="df-list">
              {answer.destination.alsoSee.map((link) => (
                <li key={link.url}>
                  <a href={link.url}>{link.title}</a>
                </li>
              ))}
            </ul>
          ) : null}
          <ul className="df-list">
            {(answer.limitations).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <form className="df-section">
        <h2>Birth jurisdiction</h2>
        <div className="df-field">
          <label htmlFor="birth-jurisdiction">Where was the birth registered?</label>
          <span id="birth-jurisdiction-hint" className="df-hint">
            Use the place on the record, not the state where you live now.
          </span>
          <select
            id="birth-jurisdiction"
            aria-describedby="birth-jurisdiction-hint"
            value={birthChoice}
            onChange={(event) => {
              setBirthChoice(event.target.value);
              setBirthSplit("");
              setSaveNote("");
            }}
          >
            <option value="">Choose a place</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        </div>
        {birthChoice === "ny" ? (
          <SplitChoice
            name="birth-new-york"
            value={birthSplit}
            onChange={setBirthSplit}
          />
        ) : null}

        <div className="df-field">
          <label htmlFor="residence-jurisdiction">Where do you live now?</label>
          <span id="residence-jurisdiction-hint" className="df-hint">
            Optional. It does not change which office issues the certificate.
          </span>
          <select
            id="residence-jurisdiction"
            aria-describedby="residence-jurisdiction-hint"
            value={homeChoice}
            onChange={(event) => {
              setHomeChoice(event.target.value);
              setHomeSplit("");
              setSaveNote("");
            }}
          >
            <option value="">Choose a place</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        </div>
        {homeChoice === "ny" ? (
          <SplitChoice name="home-new-york" value={homeSplit} onChange={setHomeSplit} />
        ) : null}

        {!result.ok ? (
          <ul className="df-list">
            {result.errors.map((error) => (
              <li key={error.path} className="df-error">
                {error.message}
              </li>
            ))}
          </ul>
        ) : null}
        {answer?.ok && answer.sandbox.missing.length > 0 ? (
          <ul className="df-list">
            {answer.sandbox.missing.map((item) => (
              <li key={item.path}>{item.question}</li>
            ))}
          </ul>
        ) : null}
      </form>

      {answer?.destination ? (
        <section className="df-section" aria-labelledby="checklist-heading">
          <h2 id="checklist-heading">Checklist</h2>
          <p className="df-note">
            A target date is your personal reminder. It is not an official deadline. Dayfolio does
            not collect an ID number or a copy of the certificate.
          </p>
          {answer.tasks.map((task) => (
            <fieldset key={task.key}>
              <legend>{task.label}</legend>
              <p className="df-note">
                Status: {task.status === "completed" ? "Completed" : "Waiting"}.{" "}
                {task.deadlineNote}
              </p>
              <div className="df-field">
                <label htmlFor={`${task.key}-owner`}>Owner</label>
                <input
                  id={`${task.key}-owner`}
                  value={task.owner}
                  onChange={(event) => updateTask(task.key, { owner: event.target.value, status: task.status })}
                />
              </div>
              <label className="df-choice">
                <input
                  type="radio"
                  name={`${task.key}-status`}
                  checked={task.status === "waiting"}
                  onChange={() => updateTask(task.key, { status: "waiting", owner: task.owner })}
                />
                Waiting
              </label>
              <label className="df-choice">
                <input
                  type="radio"
                  name={`${task.key}-status`}
                  checked={task.status === "completed"}
                  onChange={() => updateTask(task.key, { status: "completed", owner: task.owner })}
                />
                Completed
              </label>
              <div className="df-field">
                <label htmlFor={`${task.key}-date`}>{TASK_DATE_LABEL[task.key]}</label>
                <input
                  id={`${task.key}-date`}
                  type="date"
                  value={task.targetDate ?? ""}
                  onChange={(event) =>
                    updateTask(task.key, {
                      owner: task.owner,
                      status: task.status,
                      targetDate: event.target.value || undefined,
                    })
                  }
                />
              </div>
            </fieldset>
          ))}
          <div className="df-actions">
            <button
              className="df-button"
              type="button"
              onClick={() => {
                onSaveRequest?.({ input, result });
                setSaveNote(
                  "Your checklist stays on this page. Saving an account is separate. This guide does not store the certificate.",
                );
              }}
            >
              Save checklist
            </button>
          </div>
          {saveNote ? (
            <p className="df-status" role="status">
              {saveNote}
            </p>
          ) : null}
        </section>
      ) : null}

      <details className="df-section">
        <summary>Sources</summary>
        <ul className="df-list">
          {answer?.educate.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url}>{source.title}</a>
              <span className="df-source">
                {" "}
                {source.role}. Reviewed {source.reviewedOn}.
              </span>
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}

function SplitChoice({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend>Which New York office?</legend>
      <label className="df-choice">
        <input
          type="radio"
          name={name}
          checked={value === "nyc"}
          onChange={() => onChange("nyc")}
        />
        New York City (Bronx, Brooklyn, Manhattan, Queens, or Staten Island)
      </label>
      <label className="df-choice">
        <input
          type="radio"
          name={name}
          checked={value === "ny-state"}
          onChange={() => onChange("ny-state")}
        />
        Elsewhere in New York State
      </label>
    </fieldset>
  );
}

function placeOptions(): { id: string; name: string }[] {
  const withoutSplit = jurisdictions.filter((item) => item.id !== "nyc" && item.id !== "ny-state");
  const newYork: Jurisdiction = {
    id: "ny",
    name: "New York",
    kind: "state",
    lookup: withoutSplit[0]?.lookup ?? {
      title: "New York",
      url: "https://www.cdc.gov/nchs/w2w/index.htm",
      publisher: "CDC National Center for Health Statistics",
      sourceReviewedOn: "2022-08-15",
    },
  };
  return [...withoutSplit, newYork, { id: "unsure", name: "I’m not sure", kind: "other", lookup: newYork.lookup }]
    .map((item) => ({ id: item.id, name: item.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function selectedId(choice: string, split: string): string {
  if (!choice) return "";
  if (choice === "ny") return split || "ny";
  return choice;
}

function linkLabel(answer: Extract<BirthEvaluation, { ok: true }>): string {
  if (answer.destination?.kind === "issuing-authority" && answer.destination.authorityName) {
    return answer.destination.authorityName;
  }
  const place = answer.tasks
    .find((task) => task.key === "confirm-birth-jurisdiction")
    ?.label.replace("Confirm the birth was registered in ", "")
    .replace(", not where you live now.", "");
  return place ? `Official lookup for ${place}` : "Official lookup";
}
