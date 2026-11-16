"use client";

import JSZip from "jszip";
import * as XLSX from "xlsx";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { EmailGate } from "./email-gate";
import { currentUserEmail, notifyTokenCounter, TokenCounter } from "./token-counter";

type QuizQuestion = {
  question: string;
  answers: string[];
  correctAnswer: number;
  explanation: string;
  source: string;
};

type Quiz = {
  title: string;
  questions: QuizQuestion[];
};

type GenerationResponse = {
  jobId?: string;
  status?: string;
  quiz?: Quiz;
  error?: string;
};

const MAX_FILES = 10;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ["pdf", "doc", "docx", "ppt", "pptx", "txt", "md", "rtf", "odt"];

function extension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function responseData(response: Response): Promise<GenerationResponse> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("The website server returned an unexpected response. Please try again.");
  }
  return response.json() as Promise<GenerationResponse>;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function xml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildQti(quiz: Quiz) {
  const zip = new JSZip();
  const quizId = `lecture_quiz_${Date.now()}`;
  const items = quiz.questions.map((q, index) => {
    const itemId = `question_${index + 1}`;
    const choices = q.answers.map((answer, answerIndex) =>
      `<response_label ident="choice_${answerIndex}"><material><mattext texttype="text/plain">${xml(answer)}</mattext></material></response_label>`
    ).join("");
    const feedback = q.explanation
      ? `<itemfeedback ident="general_fb"><flow_mat><material><mattext texttype="text/html">${xml(q.explanation)}${q.source ? ` Source: ${xml(q.source)}` : ""}</mattext></material></flow_mat></itemfeedback>`
      : "";

    return `<item ident="${itemId}" title="Question ${index + 1}">
      <itemmetadata><qtimetadata>
        <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>multiple_choice_question</fieldentry></qtimetadatafield>
        <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>1.0</fieldentry></qtimetadatafield>
        <qtimetadatafield><fieldlabel>assessment_question_identifierref</fieldlabel><fieldentry>${itemId}</fieldentry></qtimetadatafield>
      </qtimetadata></itemmetadata>
      <presentation>
        <material><mattext texttype="text/html">${xml(q.question)}</mattext></material>
        <response_lid ident="response1" rcardinality="Single"><render_choice shuffle="Yes">${choices}</render_choice></response_lid>
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
        <respcondition continue="No"><conditionvar><varequal respident="response1">choice_${q.correctAnswer}</varequal></conditionvar><setvar action="Set" varname="SCORE">100</setvar><displayfeedback feedbacktype="Response" linkrefid="general_fb"/></respcondition>
      </resprocessing>
      ${feedback}
    </item>`;
  }).join("\n");

  const assessment = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">
  <assessment ident="${quizId}" title="${xml(quiz.title)}">
    <qtimetadata><qtimetadatafield><fieldlabel>cc_maxattempts</fieldlabel><fieldentry>1</fieldentry></qtimetadatafield></qtimetadata>
    <section ident="root_section">${items}</section>
  </assessment>
</questestinterop>`;

  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${quizId}" xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1" xmlns:imsqti="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <metadata><schema>IMS Content</schema><schemaversion>1.1.3</schemaversion></metadata>
  <organizations/>
  <resources><resource identifier="${quizId}_resource" type="imsqti_xmlv1p2" href="quiz.xml"><file href="quiz.xml"/></resource></resources>
</manifest>`;

  zip.file("imsmanifest.xml", manifest);
  zip.file("quiz.xml", assessment);
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

function buildVevoxWorkbook(quiz: Quiz) {
  const choiceColumns = Array.from(
    { length: Math.max(2, ...quiz.questions.map((question) => question.answers.length)) },
    (_, index) => `Choice${index + 1}`,
  );
  const headers = ["Type", "Title", "SurveyName", ...choiceColumns, "CorrectAnswer", "CorrectAnswerExplanation", "AllowedSelections"];
  const rows = quiz.questions.map((question) => ({
    Type: "MCQ",
    Title: question.question,
    SurveyName: quiz.title,
    ...Object.fromEntries(choiceColumns.map((column, index) => [column, question.answers[index] ?? ""])),
    CorrectAnswer: question.correctAnswer + 1,
    CorrectAnswerExplanation: question.explanation || "",
    AllowedSelections: 1,
  }));
  const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  sheet["!cols"] = headers.map((header) => ({ wch: header.startsWith("Choice") || header === "Title" ? 42 : 25 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Polls");
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [questionCount, setQuestionCount] = useState("10");
  const [answerCount, setAnswerCount] = useState("4");
  const [difficulty, setDifficulty] = useState("mixed");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const [dragging, setDragging] = useState(false);
  const totalBytes = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);

  function addFiles(incoming: File[]) {
    setError("");
    const unique = incoming.filter((file) => !files.some((current) => current.name === file.name && current.size === file.size));
    const next = [...files, ...unique];
    if (next.length > MAX_FILES) {
      setError(`You can upload a maximum of ${MAX_FILES} files.`);
      return;
    }
    if (next.some((file) => !ACCEPTED_EXTENSIONS.includes(extension(file.name)))) {
      setError("Please use PDF, Word, PowerPoint, RTF, ODT, Markdown or text files.");
      return;
    }
    if (next.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) {
      setError("The combined file size must be 25 MB or less.");
      return;
    }
    setFiles(next);
    setQuiz(null);
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (!files.length) {
      setError("Add at least one source file before generating your quiz.");
      return;
    }
    setLoading(true);
    setGenerationStatus("Uploading your files…");
    setError("");
    setQuiz(null);
    try {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      form.append("questionCount", questionCount);
      form.append("answerCount", answerCount);
      form.append("difficulty", difficulty);
      const response = await fetch("/api/integrated/lecture-quiz/generate", { method: "POST", body: form, headers: { "x-user-email": currentUserEmail() } });
      let data = await responseData(response);
      if (!response.ok) throw new Error(data.error || "The quiz could not be generated.");
      if (data.quiz) {
        setQuiz(data.quiz);
      } else {
        if (!data.jobId) throw new Error("The quiz could not be started. Please try again.");
        const jobId = data.jobId;
        setGenerationStatus("Creating questions from your materials…");
        const deadline = Date.now() + 9 * 60 * 1000;
        while (Date.now() < deadline) {
          await wait(2000);
          const statusResponse = await fetch(`/api/integrated/lecture-quiz/generate/status?id=${encodeURIComponent(jobId)}`, { cache: "no-store", headers: { "x-user-email": currentUserEmail() } });
          data = await responseData(statusResponse);
          if (!statusResponse.ok) throw new Error(data.error || "The quiz could not be generated.");
          if (data.quiz) {
            setQuiz(data.quiz);
            break;
          }
        }
        if (!data.quiz) throw new Error("This quiz is taking longer than expected. Please try again with fewer questions or a smaller file.");
      }
      notifyTokenCounter();
      window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The quiz could not be generated.");
    } finally {
      setLoading(false);
      setGenerationStatus("");
    }
  }

  async function download() {
    if (!quiz) return;
    const blob = await buildQti(quiz);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${quiz.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "lecture-quiz"}-canvas-qti.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadVevox() {
    if (!quiz) return;
    const blob = new Blob([buildVevoxWorkbook(quiz)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${quiz.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "lecture-quiz"}-vevox-import.xlsx`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function clearQuizAndFiles() {
    setFiles([]);
    setQuiz(null);
    setError("");
    setGenerationStatus("");
    setDragging(false);
    if (inputRef.current) inputRef.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <EmailGate><main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Lecture Quiz AI home"><span className="brand-mark">Q</span><span>Lecture Quiz AI</span></a>
        <div className="header-actions"><TokenCounter /><span className="header-note">Source-based quizzes, ready for Canvas</span></div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span>✦</span> TURN TEACHING MATERIALS INTO MCQS</p>
          <h1>Your lecture files,<br/><em>made testable.</em></h1>
          <p className="intro">Upload your materials, choose the shape of the quiz and generate fresh questions grounded in your sources.</p>
          <div className="trust-row"><span>✓ Up to 10 files</span><span>✓ Up to 60 questions</span><span>✓ Canvas QTI ZIP</span></div>
        </div>

        <form className="builder-card" onSubmit={generate}>
          <div className="card-heading"><div><p className="card-kicker">BUILD A NEW QUIZ</p><h2>Choose your source files</h2></div><span className="step-pill">1 of 2</span></div>
          <input ref={inputRef} className="sr-only" type="file" multiple accept={ACCEPTED_EXTENSIONS.map((item) => `.${item}`).join(",")} onChange={handleFileInput}/>
          <button
            className={`dropzone ${dragging ? "dragging" : ""}`}
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}
          >
            <span className="upload-icon" aria-hidden="true">↑</span>
            <strong>Drop files here or browse</strong>
            <small>PDF, Word, PowerPoint or text · 10 files · 25 MB total</small>
          </button>

          {files.length > 0 && <div className="file-list" aria-label="Selected files">
            <div className="file-summary"><strong>{files.length} {files.length === 1 ? "file" : "files"} ready</strong><span>{formatBytes(totalBytes)}</span></div>
            {files.map((file, index) => <div className="file-row" key={`${file.name}-${file.size}`}><span className="file-type">{extension(file.name).toUpperCase()}</span><span className="file-name">{file.name}</span><span>{formatBytes(file.size)}</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => { setFiles(files.filter((_, i) => i !== index)); setQuiz(null); }}>×</button></div>)}
          </div>}

          <div className="settings-heading"><div><p className="card-kicker">QUIZ SETTINGS</p><h2>Set the challenge</h2></div><span className="step-pill">2 of 2</span></div>
          <div className="settings-grid">
            <label><span>Questions</span><select value={questionCount} onChange={(e) => setQuestionCount(e.target.value)}>{Array.from({length:60}, (_, i) => i + 1).map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
            <label><span>Answers each</span><select value={answerCount} onChange={(e) => setAnswerCount(e.target.value)}>{[2,3,4,5,6].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
            <label><span>Difficulty</span><select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="challenging">Challenging</option><option value="mixed">Mixed</option></select></label>
          </div>
          {error && <div className="error" role="alert">{error}</div>}
          <button className="generate-button" type="submit" disabled={loading || files.length === 0}>{loading ? <><span className="spinner"/>{generationStatus || "Creating your quiz…"}</> : <>Generate MCQs <span aria-hidden="true">→</span></>}</button>
          <p className="privacy-note">Files are sent securely for this generation and are not stored by this website. OpenAI API usage charges may apply.</p>
        </form>
      </section>

      {quiz && <section className="results" ref={resultsRef}>
        <div className="results-head"><div><p className="eyebrow">QUIZ READY</p><h2>{quiz.title}</h2><p>{quiz.questions.length} questions · correct answers highlighted in green</p></div><div className="download-actions"><button className="download-button" onClick={download}>Canvas QTI ZIP <span>↓</span></button><button className="download-button vevox-button" onClick={downloadVevox}>Vevox Excel <span>↓</span></button></div></div>
        <div className="question-list">
          {quiz.questions.map((item, index) => <article className="question-card" key={index}>
            <div className="question-number">{String(index + 1).padStart(2, "0")}</div>
            <div className="question-content"><h3>{item.question}</h3><div className="answers">{item.answers.map((answer, answerIndex) => <div className={`answer ${answerIndex === item.correctAnswer ? "correct" : ""}`} key={answerIndex}><span>{String.fromCharCode(65 + answerIndex)}</span><p>{answer}</p>{answerIndex === item.correctAnswer && <strong>Correct</strong>}</div>)}</div><div className="explanation"><strong>Why?</strong> {item.explanation}{item.source && <span> Source: {item.source}</span>}</div></div>
          </article>)}
        </div>
        <div className="results-actions"><button className="download-button" onClick={download}>Download Canvas QTI ZIP <span>↓</span></button><button className="download-button vevox-button" onClick={downloadVevox}>Download Vevox Excel <span>↓</span></button><button className="start-over" onClick={clearQuizAndFiles}>Clear quiz &amp; files</button></div>
      </section>}

      <section className="how-it-works">
        <p className="eyebrow centered">DESIGNED FOR TEACHING</p>
        <div className="features"><article><span>01</span><h3>Source faithful</h3><p>Questions are instructed to rely only on the uploaded teaching materials.</p></article><article><span>02</span><h3>Easy to review</h3><p>Correct answers, explanations and source references appear immediately.</p></article><article><span>03</span><h3>Ready to import</h3><p>Download either a Canvas QTI ZIP or a Vevox Excel import file.</p></article></div>
      </section>
      <footer><div className="brand"><span className="brand-mark">Q</span><span>Lecture Quiz AI</span></div><p>Study smarter. Teach efficiently.</p></footer>
    </main></EmailGate>
  );
}
