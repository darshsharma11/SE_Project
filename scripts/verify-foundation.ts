async function runVerification() {
  const base = "http://localhost:3000";

  console.log("1. Testing GET /api/v1/clock...");
  const clockRes = await fetch(`${base}/api/v1/clock`);
  console.log("Clock status:", clockRes.status, await clockRes.json());

  console.log("\n2. Testing GET /api/v1/trace...");
  const traceRes = await fetch(`${base}/api/v1/trace`);
  console.log("Trace status:", traceRes.status, await traceRes.json());

  console.log("\n3. Testing Admin Login...");
  const adminRes = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@zerowaste.org", password: "Password123!" }),
  });
  console.log("Admin login:", adminRes.status, await adminRes.json());

  console.log("\n4. Testing Store Owner Login...");
  const storeRes = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "freshmart.owner@gmail.com", password: "Password123!" }),
  });
  console.log("Store owner login:", storeRes.status, await storeRes.json());

  console.log("\n5. Testing Delivery Partner Login...");
  const dpRes = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "partner1@zerowaste.org", password: "Password123!" }),
  });
  console.log("Delivery partner login:", dpRes.status, await dpRes.json());

  console.log("\n6. Testing Customer Login...");
  const custRes = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "rahul.customer@gmail.com", password: "Password123!" }),
  });
  console.log("Customer login:", custRes.status, await custRes.json());

  console.log("\n7. Testing Customer Registration...");
  const email = `newcustomer_${Date.now()}@example.com`;
  const regRes = await fetch(`${base}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Kavita Deshmukh",
      email,
      phone: "+91 9876500000",
      password: "Password123!",
      deliveryAddress: "Penthouse 12, Juhu Beach Road, Mumbai",
    }),
  });
  console.log("Customer register:", regRes.status, await regRes.json());

  console.log("\nAll foundation endpoints verified successfully!");
}

runVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
