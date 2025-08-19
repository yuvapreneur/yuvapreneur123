require('dotenv').config();
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize Razorpay instance
const razorpay = new Razorpay({
	key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_key_id',
	key_secret: process.env.RAZORPAY_KEY_SECRET || 'rzp_test_key_secret'
});

app.get('/buy', async (req, res) => {
	try {
		const email = req.query.email || '';
		const name = req.query.name || '';
		const phone = req.query.phone || '';
		const bonusId = req.query.bonusId || '';
		const priceParam = req.query.price ? parseInt(req.query.price, 10) : null;

		const isBonus = Boolean(bonusId);
		const amountRupees = priceParam && priceParam > 0 ? priceParam : 499; // default 499
		const amountPaise = amountRupees * 100;
		const productLabel = isBonus ? `Bonus-${bonusId}` : 'Yuvapreneur-Course';

		const order = await razorpay.orders.create({
			amount: amountPaise,
			currency: 'INR',
			receipt: `rcpt_${Date.now()}`,
			notes: { email, name, phone, product: productLabel }
		});

		const html = `<!DOCTYPE html>
		<html lang="hi">
		<head>
		  <meta charset="UTF-8" />
		  <meta name="viewport" content="width=device-width, initial-scale=1" />
		  <title>भुगतान जारी रखें</title>
		  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
		  <style>body{font-family: sans-serif; padding: 24px;} .btn{background:#b22222;color:#fff;padding:12px 16px;border:none;border-radius:4px;cursor:pointer} .wrap{max-width:520px;margin:40px auto;text-align:center}</style>
		</head>
		<body>
		<div class="wrap">
		<h2>भुगतान जारी रखें</h2>
		<p>राशि: ₹${amountRupees}</p>
		<button class="btn" id="payBtn">Pay Now</button>
		</div>
		<script>
		  const options = {
			key: ${JSON.stringify(process.env.RAZORPAY_KEY_ID || 'rzp_test_key_id')},
			amount: ${JSON.stringify(amountPaise)},
			currency: 'INR',
			name: 'ThatCourse - युवा उद्यमी',
			description: ${JSON.stringify(productLabel)},
			order_id: ${JSON.stringify(order.id)},
			prefill: { name: ${JSON.stringify(name)}, email: ${JSON.stringify(email)}, contact: ${JSON.stringify(phone)} },
			notes: { product: ${JSON.stringify(productLabel)} },
			theme: { color: '#b22222' },
			handler: async function (response) {
			  try {
				const verifyRes = await fetch('/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(response) });
				const data = await verifyRes.json();
				if (data && data.valid) {
				  window.location.href = '/success.html';
				} else {
				  window.location.href = '/failure.html';
				}
			  } catch (e) { window.location.href = '/failure.html'; }
			},
			modal: { ondismiss: function() { window.location.href = '/'; } }
		  };
		  document.getElementById('payBtn').addEventListener('click', function() { new Razorpay(options).open(); });
		</script>
		</body>
		</html>`;

		res.status(200).send(html);
	} catch (err) {
		console.error('Error creating order', err);
		res.status(500).send('Error creating order');
	}
});

app.post('/verify', (req, res) => {
	try {
		const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
		if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
			return res.status(400).json({ valid: false, reason: 'missing_fields' });
		}
		const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'rzp_test_key_secret');
		hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
		const expectedSignature = hmac.digest('hex');
		const isValid = expectedSignature === razorpay_signature;
		return res.json({ valid: isValid });
	} catch (err) {
		console.error('Verify error', err);
		return res.status(500).json({ valid: false });
	}
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
	console.log(`Server listening on http://localhost:${PORT}`);
});
