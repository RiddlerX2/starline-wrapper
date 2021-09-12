/*
	Starline wrapper v.1.0.x
	Module provide simple access to REST API of the Starline alarm config and navigation data
	
	For more information about operations and its parameters look at:
		https://developer.starline.ru/#api-_
*/

/*Define dependencies*/
const axios = require('axios');
const crypto = require('crypto');
const FormData = require('form-data');

/*Define base class*/
class Basis {
	/*Simple detectors of Objects and Arrays*/
	isObject = (a) => {
		return (!!a) && (a.constructor === Object);
	};
	
	isArray = (a) => {
    return (!!a) && (a.constructor === Array);
	};
	
	extendObject(base, append) {
		for (let item in append) {
			if (this.isObject(base[item]) && this.isObject(append[item])) {
				this.extendObject(base[item], append[item]);
			} else {
				base[item] = append[item];
			}
		}
	};
	
	static waitFor(ms) {
		return new Promise((resolve, reject) => {
			setTimeout(() => {resolve(true)}, ms);
		});
	}
	
	constructor() {
		
	}
}

 /*Define all links to REST API*/
class StarlineURLs extends Basis {
	authPrefix = 'https://id.starline.ru/apiV3/';
	apiPrefix = 'https://developer.starline.ru/json/';
	
	apiURL(version, subject, id, command) {
		return `${this.apiPrefix}v${version}/${subject}/${id}/${command}`;
	}

	/*Unified execute action with callback*/
	execute(url, method, headers, params, data, callback) {
		let axiosParams = {
			method : method,
			url : url,
			headers : {
				Accept : 'application/json'
			},
			params : {},
			data : {}
		};
		
		if (this.isObject(headers)) {
			this.extendObject(axiosParams.headers, headers);
		}
		
		if (this.isObject(params)) {
			this.extendObject(axiosParams.params, params);
		}
		
		if ((data || {}).constructor.name === 'FormData') {
			axiosParams.data = data
		} else if (this.isObject(data)) {
			this.extendObject(axiosParams.data, data);
		}
		
		axios(axiosParams).then(
			(result) => {
				callback(false, result.data, result.headers);
			}
		).catch(
			(error) => {
				callback(error, false);
			}
		)
	}
	
	constructor () {
		super();
	}
}

/*Define authenticator*/
class StarlineAuth extends StarlineURLs {
	#appId;
	#secret;
	#md5secret;
	#login;
	#password;
	#userId;
	#cookieSLNET;
	#failed;
	failData;
	
	doAuth () {
		this.setAuthCookie('');
		/*4 steps for authorization on SLNET*/
		this.#md5secret = crypto.createHash('md5').update(this.#secret).digest('hex');
		/*Step 1*/
		this.execute(`${this.authPrefix}application/getCode`, 'GET', null, 
			{appId : this.#appId, secret : this.#md5secret}, null, (error, data) => {
				if (!error && data.state) {
					/*Step 2*/
					this.#md5secret = crypto.createHash('md5').update(this.#secret + data.desc.code).digest('hex');
					this.execute(`${this.authPrefix}application/getToken`, 'GET', null, 
						{appId : this.#appId, secret : this.#md5secret}, null, (error, data) => {
							if (!error && data.state) {
								/*Step 3*/
								let bodyFormData = new FormData();
								bodyFormData.append('login', this.#login);
								bodyFormData.append('pass', crypto.createHash('sha1').update(this.#password).digest('hex'));
								this.execute(`${this.authPrefix}user/login`, 'POST', {
										'content-type' : `multipart/form-data;boundary=${bodyFormData.getBoundary()}`,
										token : data.desc.token
									}, 
									null, bodyFormData, (error, data) => {
										if (!error && data.state) {
											/*Step 4*/
											this.execute(`${this.apiPrefix}v2/auth.slid`, 'POST', null, null, {slid_token : data.desc.user_token}, (error, data, headers) => {
													if (!error && data.code == '200') {
														this.#userId = data.user_id;
														let cookie = headers['set-cookie'][0];
														cookie = cookie.substring(0, cookie.indexOf(';'));
														this.setAuthCookie(cookie);
													} else {
														this.#failed = true;
														this.failData = error || data;
													}
												}
											);
										} else {
											this.#failed = true;
											this.failData = error || data;
										}
									}
								);
							} else {
								this.#failed = true;
								this.failData = error || data;
							}
						}
					);
				} else {
					this.#failed = true;
					this.failData = error || data;
				}
			}
		);
	}
	
	constructor (appId, secret, login, password, autoRefresh) {
		super();
		this.#appId = appId;
		this.#secret = secret;
		this.#login = login;
		this.#password = password;
		this.doAuth();
		/*Refresh authorization each 3 hours (max lifetime 4 hours)*/
		if (!!autoRefresh) {
			setInterval(() => {this.doAuth()}, 10800000);
		}
	}
	
	getAuthCookie () {
		return this.#cookieSLNET;
	}
	
	setAuthCookie (cookie) {
		this.#cookieSLNET = cookie;
	}
	
	getUserId () {
		return this.#userId;
	}
	
	isReady() {
		return !!(this.#cookieSLNET)
	}
	
	isFail() {
		return !!(this.#failed)
	}
}

/*Main class*/
class Starline extends StarlineURLs {
	#authObject;
	
	isReady() {
		return !!(this.#authObject.isReady())
	}

	isFail() {
		return !!(this.#authObject.isFail())
	}
	
	getAuthCookie () {
		return this.#authObject.getAuthCookie();
	}
	
	getUserId () {
		return this.#authObject.getUserId();
	}
	
	waitReady() {
		return new Promise(async (resolve, reject) => {
			while (!this.isReady() && !this.isFail()) {
				await Basis.waitFor(100);
			};
			if (this.isReady()) {
				resolve(true);
			} else {
				reject(false);
			}
		});
	}
	
	constructor (authObject) {
		super();
		this.#authObject = authObject;
	};
}

/*Beacon list*/
class Beacons extends Starline {
	list;
	autoUpdate = false;
	
	isReady() {
		return !!(this.list);
	}
	
	updateList() {
		return new Promise(async (resolve, reject) => {
			if (super.isReady()) {
				let url = this.apiURL(2, 'user', this.getUserId(), 'user_info');
				this.execute(url, 'POST', {Cookie : this.getAuthCookie()}, null, null, (error, data) => {
					if (error) {
						reject(error);
					}
					this.list = data.devices;
					resolve(true);
					if (this.autoUpdate) {
						setTimeout(this.updateList, 600000);
					}
				});
			} else {
				resolve(false);
			}
		});
	}
	
	constructor(authObject, autoUpdate) {
		super(authObject);
		this.autoUpdate = !!(autoUpdate);
	}
}

/*Executes async command*/
class Command extends Starline {
	deviceID;

	execute(command, value, variables) {
		return new Promise((resolve, reject) => {
			if (this.isReady()) {
				let data = {
					type : command,
					value : value
				};
				if (variables && this.isObject(variables)) {
					data.variables = variables;
				}
				let url = this.apiURL(2, 'device', this.deviceID, 'async');
				super.execute(url, 'POST', {Cookie : this.getAuthCookie()}, null, data, (error, data) => {
					if (error) {
						reject(error);
					}
					resolve(data.cmd_id);
				});
			} else {
				reject(false);
			}
		});
	}

	constructor(authObject, deviceID) {
		super(authObject);
		this.deviceID = deviceID;
	}
}

/*Check state of the executed command*/
class State extends Command {
	commandID;

	execute() {
		return new Promise((resolve, reject) => {
			if (this.isReady()) {
				let url = this.apiURL(2, 'device', this.deviceID, 'async') + '/' + this.commandID;
				super.execute(url, 'GET', {Cookie : this.getAuthCookie()}, null, null, (error, data) => {
					if (error) {
						reject(error);
					}
					resolve(data);
				});
			} else {
				reject(false);
			}
		});
	}

	constructor(authObject, deviceID, commandID) {
		super(authObject, deviceID);
		this.commandID = commandID;
	}
}

/*Get track for device*/
class Track extends Starline {
	deviceID;

	execute(timeFrom, timeTo) {
		return new Promise((resolve, reject) => {
			if (this.isReady()) {
				let data = {
					begin : timeFrom,
					end : timeTo,
					split_way : false,
					div_days : true,
					time_zone : true,
					filtering : true
					};
				let url = this.apiURL(1, 'device', this.deviceID, 'ways');
				super.execute(url, 'POST', {Cookie : this.getAuthCookie()}, null, data, (error, data) => {
					if (error) {
						reject(error);
					}
					resolve(data);
				});
			} else {
				reject(false);
			}
		});
	}

	constructor(authObject, deviceID) {
		super(authObject);
		this.deviceID = deviceID;
	}
}

/*Get ODB state for device*/
class ODB extends Starline {
	deviceID;

	execute() {
		return new Promise((resolve, reject) => {
			if (this.isReady()) {
				let url = this.apiURL(1, 'device', this.deviceID, 'obd_params');
				super.execute(url, 'POST', {Cookie : this.getAuthCookie()}, null, null, (error, data) => {
					if (error) {
						reject(error);
					}
					resolve(data);
				});
			} else {
				reject(false);
			}
		});
	}

	constructor(authObject, deviceID) {
		super(authObject);
		this.deviceID = deviceID;
	}
}

/*Export classes*/
exports.StarlineAuth = StarlineAuth;
exports.Starline = Starline;
exports.Beacons = Beacons;
exports.Command = Command;
exports.State = State;
exports.Track = Track;
exports.ODB = ODB;