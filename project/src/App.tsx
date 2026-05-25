import { useState } from "react";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { IngestPage } from "./components/IngestPage";
import { ReviewPage } from "./components/ReviewPage";
import { HistoryPage } from "./components/HistoryPage";

type Page = "dashboard" | "ingest" | "review" | "history";

function App() {
  const [page, setPage] = useState<Page>("dashboard");

  function renderPage() {
    switch (page) {
      case "dashboard": return <Dashboard onNavigate={(p) => setPage(p)} />;
      case "ingest": return <IngestPage />;
      case "review": return <ReviewPage />;
      case "history": return <HistoryPage />;
    }
  }

  return (
    <Layout page={page} onNavigate={setPage}>
      {renderPage()}
    </Layout>
  );
}

export default App;
