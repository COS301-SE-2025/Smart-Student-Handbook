// app/faqs/page.tsx  (SERVER COMPONENT)
export const metadata = {
  title: "FAQs · Smart Student Handbook",
  description: "Answers to common questions about the Smart Student Handbook.",
};

import FAQClient from "./FAQClient";

export default function Page() {
  return <FAQClient />;
}
