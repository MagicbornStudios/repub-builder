export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
      <article className="max-w-2xl mx-auto prose prose-invert">
        <h1 className="text-3xl font-bold mb-4">Sample RichEPub Book</h1>
        <p className="text-slate-300 leading-relaxed">
          This is a sample book built with the RichEPub format. It uses React and Tailwind CSS,
          bundled into a single .repub file for reading in a web-based viewer.
        </p>
        <p className="text-slate-300 leading-relaxed">
          The format supports full React components and npm dependencies, with styles compiled at
          build time. This file is the first page of the sample book.
        </p>
      </article>
    </div>
  );
}
