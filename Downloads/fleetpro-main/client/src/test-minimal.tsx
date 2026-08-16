import { createRoot } from "react-dom/client";

function TestApp() {
  return (
    <div style={{ padding: "20px" }}>
      <h1>Test App - Basic Render</h1>
      <p>If you see this, React is working!</p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<TestApp />);