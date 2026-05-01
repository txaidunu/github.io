async function createOrder() {
  try {
    document.getElementById("status").innerText = "Creating order...";

    const res = await fetch("https://txaidunu-github-io.vercel.app/api/create-order", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        packageType: selectedPackage,
        address: {
          name: document.getElementById("name").value,
          address: document.getElementById("address").value,
          city: document.getElementById("city").value,
          state: document.getElementById("state").value,
          zip: document.getElementById("zip").value
        }
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert("Order error: " + JSON.stringify(data));
      return;
    }

    document.getElementById("amount").innerText = data.tokenAmount + " tokens";
    document.getElementById("paylink").href = data.payUrl;

    document.getElementById("qr").src =
      "https://api.qrserver.com/v1/create-qr-code/?data=" +
      encodeURIComponent(data.payUrl);

    document.getElementById("payment").style.display = "block";

    checkPayment(data.reference);

  } catch (err) {
    alert("Checkout error: " + err.message);
  }
}
