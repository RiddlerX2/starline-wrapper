# starline_wrapper
 Module provide simple access to REST API of the Starline alarm config and navigation data

Usage sample:
```
let slAuth = require('./index').StarlineAuth;
let slBase = require('./index');

async function x() {
	//Create authorization
	let objAuth = new slAuth(yourAppID, 'yourAppToken', 'yourLogin', 'yourPassword');
	//Create main executor
	let objBase = new slBase.Starline(objAuth);
	//Wait until authorization completes or return error
	objBase.waitReady()
	.then(async (data) => {
		//Create beacons list
		let objBeac = new slBase.Beacons(objAuth);
		//update beacons list
		await objBeac.updateList();
		console.log('Done');
	})
	.catch((data) => {
		console.log('error!')
	});
}

x();
```

! Remember, you must wait until authorization complete before using other methods.
If authorization not completed or fails, any other operations rejected and return false.

Documentation
StarlineAuth - provide authorization on SLNET server
Usage:
```
new StarlineAuth(
	yourAppID, //You can create app using Starline control panel
	'yourAppToken',  //You can create app using Starline control panel
	'yourLogin',  //Your login to Starline telematics
	'yourPassword', //Your password to Starline telematics
	autoRefresh //Optional - if set to true, then new SLNET authorization refreshed every 4 hour, else authorization invalidates after 4 hour
);
```

Starline - basic class for accessing Starline state
Usage:
```
new Starline(
	authObject // Object created with StarlineAuth
);
```

Beacons - class retreave list of all assigned beacons for authorized user
Usage:
```
new Starline(
	authObject, // Object created with StarlineAuth
	autoUpdate //If set to true, then list updates every 10 minutes
);
```

Command - send async command to Starline server
List of available commands described in Command array of listed beacons
Usage:
```
new Command(
	authObject, // Object created with StarlineAuth
	deviceID //ID of the device
).execute(
	command, //Name of the command that need send to Starline server
	value, //Most commands required 0 or 1 as value
	variables // Object with additional variables passes with command
);
```

State - check execution state of the command send by Command object
Usage:
```
new State(
	authObject, // Object created with StarlineAuth
	deviceID, //ID of the device
	commandID //ID of the command returned by Command(...).execute(...) function
).execute();
```

Track - get device movements and stays
Usage:
```
new State(
	authObject, // Object created with StarlineAuth
	deviceID, //ID of the device
).execute(
	timeFrom, //Unix timestamp for begining of interval
	timeTo //Unix timestamp for ending of interval (maximum 24 hours between begin and end) 
);
```

ODB - get device data through CAN-bus it contains fuel goudge volume, odometer data and board computer errors (if supported by installed device)
Usage:
```
new ODB(
	authObject, // Object created with StarlineAuth
	deviceID, //ID of the device
).execute();
```