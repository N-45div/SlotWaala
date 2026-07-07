import { evalite } from "eve/evals";

evalite("classifies a WhatsApp booking request", {
  input:
    "Customer says: AC service chahiye kal afternoon, Koramangala. Please book.",
  expected: "The agent should classify this as a booking request and collect or create booking details without asking for payment information.",
});
