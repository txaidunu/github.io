function checkPayment(ref) {
  let attempts = 0;
  const maxAttempts = 60;

  const interval = setInterval(async () => {
    attempts++;

    try {
      const r = await fetch(API_BASE + "/api/check-payment?reference=" + encodeURIComponent(ref));
      const d = await r.json();

      if (d.paid) {
        document.getElementById("status").innerText =
          "Payment confirmed!";
        clearInterval(interval);
        return;
      }

      document.getElementById("status").innerText =
        "Waiting for payment...";

      if (attempts >= maxAttempts) {
        clearInterval(interval);
      }

    } catch {
      document.getElementById("status").innerText =
        "Checking network...";
    }
  }, 10000); // every 10 seconds (not 5)
}
