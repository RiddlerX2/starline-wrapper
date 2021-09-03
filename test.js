let slAuth = require('./index').StarlineAuth;
let slBase = require('./index');

async function x() {
	let objAuth = new slAuth(2791, 'GLJuE1WqIkbLnDHPXJQUN7MGzcaAs3c3', '100@dlx51.ru', 'Fusins123starline');
	let objBase = new slBase.Starline(objAuth);
	objBase.waitReady()
	.then(async (data) => {
		let objBeac = new slBase.Beacons(objAuth);
		await objBeac.updateList();
		console.log('Done');
	})
	.catch((data) => {
		console.log('error!')
	});
}

x();