const propertyInput = document.querySelector("#property-name");
const rentalInput = document.querySelector("#monthly-rental");
const paymentStructureInputs = document.querySelectorAll(
  'input[name="paymentStructure"]',
);
const tenancyPeriodInputs = document.querySelectorAll(
  'input[name="tenancyPeriod"]',
);
const messagePreview = document.querySelector("#message-preview");
const copyButton = document.querySelector("#copy-button");
const copyButtonLabel = copyButton.querySelector("span");
const moveInSummary = document.querySelector("#move-in-summary");
const bookingSummary = document.querySelector("#booking-summary");
const propertyError = document.querySelector("#property-error");
const rentalError = document.querySelector("#rental-error");
const tenancyNote = document.querySelector("#tenancy-note");
const toast = document.querySelector("#toast");

const MAX_RENTAL = 18000;
const SST_RATE = 0.08;

const agreementFeeBands = [
  { maximum: 2000, oneYearFee: 350, twoYearFee: 500 },
  { maximum: 5000, oneYearFee: 550, twoYearFee: 800 },
  { maximum: 9000, oneYearFee: 650, twoYearFee: 1100 },
  { maximum: 12000, oneYearFee: 850, twoYearFee: 1350 },
  { maximum: 15000, oneYearFee: 950, twoYearFee: 1650 },
  { maximum: 18000, oneYearFee: 1150, twoYearFee: 1950 },
];

const paymentStructures = {
  "2-1-0.5": {
    securityMonths: 2,
    advanceMonths: 1,
    utilitiesMonths: 0.5,
  },
  "1-1-0.5": {
    securityMonths: 1,
    advanceMonths: 1,
    utilitiesMonths: 0.5,
  },
  "2-1-1": {
    securityMonths: 2,
    advanceMonths: 1,
    utilitiesMonths: 1,
  },
};

let currentMessage = "";
let toastTimer;

function parseAmount(value) {
  const sanitized = value.replace(/[^\d.]/g, "");
  const amount = Number.parseFloat(sanitized);
  return Number.isFinite(amount) ? amount : 0;
}

function formatNumber(amount) {
  return new Intl.NumberFormat("en-MY", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatCurrency(amount) {
  return `RM${formatNumber(amount)}`;
}

function getAgreementFee(rental, tenancyYears) {
  const band = agreementFeeBands.find((item) => rental <= item.maximum);
  if (!band) {
    return 0;
  }
  return tenancyYears === 2 ? band.twoYearFee : band.oneYearFee;
}

function getSelectedPaymentStructure() {
  const selected = document.querySelector(
    'input[name="paymentStructure"]:checked',
  );
  return paymentStructures[selected?.value] ?? paymentStructures["2-1-0.5"];
}

function getSelectedTenancyPeriod() {
  const selected = document.querySelector(
    'input[name="tenancyPeriod"]:checked',
  );
  return Number(selected?.value) === 2 ? 2 : 1;
}

function formatMonthLabel(months) {
  if (months === 0.5) {
    return "1/2 month";
  }
  return `${formatNumber(months)} ${months === 1 ? "month" : "months"}`;
}

function calculate(rental, structure, tenancyYears) {
  const securityDeposit = rental * structure.securityMonths;
  const utilitiesDeposit = rental * structure.utilitiesMonths;
  const advanceRental = rental * structure.advanceMonths;
  const agreementFee = getAgreementFee(rental, tenancyYears);
  const sst = advanceRental * SST_RATE;
  const refundableDeposit = securityDeposit + utilitiesDeposit;
  const totalMoveIn =
    securityDeposit + utilitiesDeposit + advanceRental + agreementFee;
  const booking = advanceRental + sst + agreementFee;
  const balance = totalMoveIn - booking;

  return {
    securityDeposit,
    utilitiesDeposit,
    advanceRental,
    agreementFee,
    sst,
    refundableDeposit,
    totalMoveIn,
    booking,
    balance,
    tenancyYears,
    ...structure,
  };
}

function buildMessage(propertyName, rental, amounts) {
  return `*${propertyName}*
Rental: *${formatCurrency(rental)}/month*

*Total Move-In Payment: ${formatCurrency(amounts.totalMoveIn)}*

*Breakdown:*

• Security Deposit, ${formatMonthLabel(amounts.securityMonths)}, refundable: ${formatCurrency(amounts.securityDeposit)}
• Utilities Deposit, ${formatMonthLabel(amounts.utilitiesMonths)}, refundable: ${formatCurrency(amounts.utilitiesDeposit)}
• Advance Rental, ${formatMonthLabel(amounts.advanceMonths)}: ${formatCurrency(amounts.advanceRental)}
• Agreement & Stamping Fee, ${amounts.tenancyYears}-year tenancy: ${formatCurrency(amounts.agreementFee)}

*Total Refundable Deposit: ${formatCurrency(amounts.refundableDeposit)}*
Refundable upon completion of the ${amounts.tenancyYears}-year tenancy, subject to the terms and conditions of the Tenancy Agreement.

*Unit Booking: ${formatCurrency(amounts.booking)}*

*Payment to Agency Account:*

Maxxan Realty Sdn Bhd
Public Bank
3207653310

*Balance Payment: ${formatCurrency(amounts.balance)}*
The balance may be paid before move-in or upon key handover, directly to the property owner's account.`;
}

function setInvalid(input, errorElement, message) {
  input.closest(".input-wrap").classList.toggle("invalid", Boolean(message));
  input.setAttribute("aria-invalid", Boolean(message).toString());
  errorElement.textContent = message;
}

function resetCopyState() {
  copyButton.classList.remove("copied");
  copyButtonLabel.textContent = "Copy WhatsApp Message";
}

function updateCalculator() {
  const propertyName = propertyInput.value.trim();
  const rental = parseAmount(rentalInput.value);
  const rentalIsValid = rental > 0 && rental <= MAX_RENTAL;

  setInvalid(
    propertyInput,
    propertyError,
    propertyName ? "" : "Please enter the property name or unit.",
  );

  let rentalMessage = "";
  if (!rental) {
    rentalMessage = "Please enter the monthly rental.";
  } else if (rental > MAX_RENTAL) {
    rentalMessage = "The provided fee schedule covers rentals up to RM18,000.";
  }
  setInvalid(rentalInput, rentalError, rentalMessage);

  if (!propertyName || !rentalIsValid) {
    currentMessage = "";
    messagePreview.textContent =
      "Complete both fields to generate the WhatsApp message.";
    moveInSummary.textContent = "—";
    bookingSummary.textContent = "—";
    copyButton.disabled = true;
    resetCopyState();
    return;
  }

  const tenancyYears = getSelectedTenancyPeriod();
  const amounts = calculate(
    rental,
    getSelectedPaymentStructure(),
    tenancyYears,
  );
  currentMessage = buildMessage(propertyName, rental, amounts);
  messagePreview.textContent = currentMessage;
  moveInSummary.textContent = formatCurrency(amounts.totalMoveIn);
  bookingSummary.textContent = formatCurrency(amounts.booking);
  tenancyNote.textContent = `${tenancyYears}-year tenancy`;
  copyButton.disabled = false;
  resetCopyState();
}

function formatRentalInput() {
  const rental = parseAmount(rentalInput.value);
  rentalInput.value = rental ? formatNumber(rental) : "";
}

async function copyMessage() {
  if (!currentMessage) {
    return;
  }

  try {
    await navigator.clipboard.writeText(currentMessage);
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = currentMessage;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    textArea.remove();
  }

  copyButton.classList.add("copied");
  copyButtonLabel.textContent = "Message Copied";
  toast.classList.add("visible");

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("visible");
    resetCopyState();
  }, 2400);
}

propertyInput.addEventListener("input", updateCalculator);
rentalInput.addEventListener("input", updateCalculator);
rentalInput.addEventListener("blur", () => {
  formatRentalInput();
  updateCalculator();
});
rentalInput.addEventListener("focus", () => rentalInput.select());
paymentStructureInputs.forEach((input) =>
  input.addEventListener("change", updateCalculator),
);
tenancyPeriodInputs.forEach((input) =>
  input.addEventListener("change", updateCalculator),
);
copyButton.addEventListener("click", copyMessage);

updateCalculator();
