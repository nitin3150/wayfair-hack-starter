import FraudDashboard from "@/components/fraud/dashboard";

export const metadata = {
  title: "Fraud Detection — Wayfair",
  description: "AI-powered refund fraud risk scoring",
};

export default function FraudPage() {
  return <FraudDashboard />;
}
