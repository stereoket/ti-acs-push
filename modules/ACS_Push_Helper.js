var configs = require('modules/Config'),
    ANDROID = configs.android,
    CloudPush;
var SIMULATOR = configs.isSimulator();
var Cloud = require('ti.cloud');
var log = configs.log;
var defaultChannelName = 'general';
if (ANDROID) {
    CloudPush = require('ti.cloudpush');
}

/**
 * Creates a new Push Notification ACS Helper Object
 * @author Ketan Majmudar ket@spiritquest.co.uk
 * @constructor
 */
var ACSpush = function () {
    "use strict";
    // Assume being called for the first time, check persistent data
    /*
     acsUserID
     acsUSerName
     acsPassword

     subscribeToPush
     loggedInToACS

     defaultACSuserName
     defaultACSuserID
     defaultACSpassword

     */

    // TODO Add possibility to set env variables via constructor to start at diff points of the script.
    // review of methods required.

    this.callbackError = false;

    this.subscribedChannels = Ti.App.Properties.getList('subscribedChannels');
    if (this.subscribedChannels === null) {
        Ti.API.warn('Setting a channel list property for a general channel set to false, as this is a first time');
        this.subscribedChannels = [{
            channel: 'general',
            state: false
        }];
        Ti.App.Properties.setList('subscribedChannels', this.subscribedChannels);
    }

};

ACSpush.prototype.checkNetwork = function () {
    "use strict";
    log("DEBUG", Ti.Network.networkTypeName);
    if (Ti.Network.networkType === Titanium.Network.NETWORK_NONE || !Ti.Network.online) {
        Ti.App.Properties.setBool('netState', false);
        return false;
    } else {
        Ti.App.Properties.setBool('netState', true);
        return true;
    }
    return false;
};

ACSpush.prototype.checkCallbacks = function (args, name) {
    log("info", "scanning for required callback methods");
    // try {
    if (!args.success || !args.error) {
        this.callbackError = true;
        throw {
            name: "ACS_PH Library Method Error",
            message: "originating method handlers (success or error) not set, cannot proceed. " + name
        }
    }
    // } catch (err) {
    //     log("error", "ACS_PH: Possible that originating method has no try/catch setup - " + err.message);
    // }
};


/**
 * Login a user to ACS and ensure Push is enabled for current device
 * @param  {object} params contains event handler for success and errors, both  methods required .
 * @return {void}        [description]
 */
ACSpush.prototype.login = function (params) {
    "use strict";
    // Network check required first before running this method



    // Check if all required callbacks are present.
    this.checkCallbacks(params, "login()");

    if (!this.checkNetwork()) {
        log("ERROR", "Network Error Check");
        params.error({
            message: "Could not fire login() ACS_PH method - due to network issue"
        });
        return false;
    }

    this.showLoggedInACSuser({
        success: params.success,
        error: params.error
    });


};

/**
 * Checks ACS to see if a user is already logged in or not, checks for ACS errors too
 * @param  {object} params callback methods for success and error
 * @return {void}
 */
ACSpush.prototype.showLoggedInACSuser = function (params) {
    var that = this;

    this.checkCallbacks(params, "showLoggedInACSuser()");
    Cloud.Users.showMe(showMeCallback);

    function showMeCallback(e) {
        log("info", 'showMeCallback() : ' + JSON.stringify(e));
        if (e.success) {
            that.loggedInToACS = true;
            var user = e.users[0];
            log("warn", 'ACS User logged in: ' + that.loggedInToACS +
                '\n id: ' + user.id + '\n' + 'first name: ' + user.first_name + '\n' + 'last name: ' + user.last_name);
            params.success();
        } else if (e.code === 401 /* Code that indicates a login is required*/ ) {
            that.loggedInToACS = false;
            log("warn", 'Warning: ' + e.message);
            params.success();
        } else if (e.error) {
            // TODO a code system to indicate state of ACS process can be used to bubble up for app error handling
            log("error", (e.error && e.name && e.message));
            params.error();
        }
        return;
    }
};

/**
 * Checks if the device needs to be registered with its associated Push server, Apple & Google
 * @param  {object} params callback methods
 * @return {void}
 */
ACSpush.prototype.getDeviceToken = function (params) {
    "use strict";
    var that = this;
    var successCallback, errorCallback, messageCallback;
    this.checkCallbacks(params, "getDeviceToken()");
    if (this.callbackError) {
        return false;
    }
    log("warn", '  getDeviceToken  ');

    // Device Registration calls for both platforms
    if (!ANDROID) {
        if (SIMULATOR) {
            params.success();
        } else {
            try {
                if (Ti.Network.remoteNotificationsEnabled) {
                    log("debug", "Setting up Push listener, have to register with server for listener" + registered);
                }
            } catch (err) {
                log("error", "error: " + err.message);
            }

            log("warn", "Device Token required. registering with Apple for new token");
            Ti.Network.registerForPushNotifications({
                types: [Ti.Network.NOTIFICATION_TYPE_BADGE,
                Ti.Network.NOTIFICATION_TYPE_ALERT, Ti.Network.NOTIFICATION_TYPE_SOUND],
                success: successCallback,
                error: errorCallback,
                callback: this.pushPayloadCallback
            });

        }
    } else {
        // Android Device Token
        CloudPush.retrieveDeviceToken({
            success: successCallback,
            error: errorCallback
        });
        // Android Event Listener to trigger when payload is received
        CloudPush.addEventListener('callback', this.pushPayloadCallback);
    }

    function successCallback(e) {
        log("warn", " getDeviceToken.successCallback() ");
        that.deviceToken = e.deviceToken;
        try {
            that.storeDeviceToken();
            params.success();
        } catch (err) {
            log("error", "ACS_PH problem with/or storing device token: " + err.message);
        }
    };

    function errorCallback(e) {
        throw {
            name: "Push Registration Error",
            message: "could not register for push notificaiton: " + JSON.stringify(e)
        }
    };
};

/**
 * Retrieve the device token from persistent memory and some checks.
 * @return {void}
 */
ACSpush.prototype.storeDeviceToken = function () {
    "use strict";
    if (typeof this.deviceToken === "string") {
        Ti.API.warn('Setting App property "deviceToken" :  ' + this.deviceToken);
        Ti.App.Properties.setString('deviceToken', this.deviceToken);
        // TODO a password generation method should be empoyed in a separate method moving forward.
        var pw = Ti.Utils.md5HexDigest(this.deviceToken).slice(0, 20);
        Ti.App.Properties.setString('acsPassword', pw);
    } else {
        Ti.API.error('Bad Device Token');
    }

    return;
};

/**
 * Push message payloads are processed by this method and contains all logic for message display and behaviour
 * @param  {object} evt push notification payload
 * @return {void}
 */
ACSpush.prototype.pushPayloadCallback = function (evt) {
    log("WARN", "Push Notice Payload Listener Triggerred");
    var that = this;
    that.payload = evt.data;
    Ti.API.info(that.payload);
    var pushTXT = "Default Title";
    // TODO Get config Values - this was removed, but a method of having preset push messages would be useful in the future
    // that.getConfigValues();
    // Setup maessage alert function


    var showMessageAlert = function (msgParams) {
        var pushAlert = Ti.UI.createAlertDialog({
            title: msgParams.title,
            message: msgParams.message,
            buttonNames: ['OK']
        });
        pushAlert.show();

        Ti.UI.iPhone.appBadge = (Ti.UI.iPhone.appBadge > 0) ? Ti.UI.iPhone.appBadge - 1 : 0;
    };

    // iOS processing of payload
    if (!ANDROID) {

        title = (that.payload.title !== undefined) ? that.payload.title : pushTXT;

        Titanium.Media.vibrate();
        // // FIXME TITLE not being exposed - CHECK
        showMessageAlert({
            title: title,
            message: that.payload.alert
        });

    } else {
        // Android processing of payload

        that.payload = JSON.parse(evt.payload);
        if (that.payload.android.title !== undefined) {
            var title = that.payload.android.title;
        } else {
            title = pushTXT;
        }

        if (that.payload.android.alert.body !== undefined) {
            var message = that.payload.android.alert.body;
        } else {
            if (that.payload.android.alert !== undefined) {
                message = that.payload.android.alert;
            }
        }

        showMessageAlert({
            title: title,
            message: message
        });

    }
};

/**
 * Will check if a user exists in the ACS userlist. Sets this.createNewUser flag
 * @param {object} params Object of search parameters for the ACS where query
 * @param {string} params.username The 'username' to be looked up
 */
ACSpush.prototype.queryNewACSuser = function (params) {
    "use strict";
    var that = this;

    this.checkCallbacks(params, "queryNewACSuser()");
    // Looking for user with device token as username

    Ti.API.info('queryNewACSuser: ' + JSON.stringify(params));

    // Checks for device simulator on iOS
    if (SIMULATOR) {
        log("warn", '  Simulator Detected  - setting predefined token  ');
        params.username = '8fe33df3e1a900a8785313164ed6cd8ffca31106b0d9a73181732d1338003bce' // default virtual TEST device ID
        this.deviceToken = '8fe33df3e1a900a8785313164ed6cd8ffca31106b0d9a73181732d1338003bce';
    }

    // requires device token to be present to run this routine.

    if (params.username !== null) {
        // Apple and Google differences in case for device tokens, normalising it here
        var queryUsername = params.username.toLowerCase();
    } else {
        queryUsername = null;
    }

    // Network check prior to making the ACS call
    if (!this.checkNetwork()) {
        log("ERROR", "Network Error Check");
        params.error({
            message: "Could not fire Cloud.Users.query in queryNewACSuser() ACS_PH - due to network issue"
        });
        return false;
    }

    Cloud.Users.query({
        where: {
            "username": queryUsername
        }
    }, userQueryCallback);

    function userQueryCallback(e) {
        log("DEBUG", JSON.stringify(e));
        if (e.success && e.users.length > 0) {
            that.createNewUser = false;
            log("WARN", 'Success User Already Setup: ');
            that.ACSuserCallback = e.users[0];
            params.success();
        } else if (e.success && e.meta.code === 200) {
            that.createNewUser = true;
            log("WARN", 'No User found with username ' + queryUsername);
            log("WARN", 'Response from ACS: ' + JSON.stringify(e));
            // deliberately do not want to trigger the error handler here, as we want to create a new user instead
            params.success();
        } else if (e.error && e.meta.code !== 200) {
            params.error({
                message: "Error response from ACS whilst running Cloud.Users.query in queryNewACSuser() "
            });
        }
    }
};
/**
 * Will create a new user account on ACS based on the device token as username and md5 password of it
 * @param  {object} params callback success and error methods
 * @return {void}
 */
ACSpush.prototype.createUserAccount = function (params) {
    var that = this;
    this.checkCallbacks(params, "createUserAccount()");
    // only run if device token is present - check here.
    // only run if user does not already exist on system. - check here
    Ti.API.warn('The info used for creating a new account' + JSON.stringify(this));
    var pw = Ti.Utils.md5HexDigest(this.deviceToken).slice(0, 20);
    Ti.API.info('**createUserAccount -username ' + this.deviceToken)
    Ti.API.info('**createUserAccount -pw ' + pw);


    // Network check prior to making the ACS call
    if (!this.checkNetwork()) {
        log("ERROR", "Network Error Check");
        params.error({
            message: "Could not fire Cloud.Users.create in createUserAccount() ACS_PH - due to network issue"
        });
        return false;
    }

    Cloud.Users.create({
        username: this.deviceToken,
        password: pw,
        password_confirmation: pw
    }, createUserCallback);


    function createUserCallback(e) {
        if (e.success) {
            that.createNewUser = false;
            var user = e.users[0];
            log("WARN", 'Success in creating user account: ' + 'id: ' + user.id + ' ' + 'username: ' + user.username + ' ');
            Ti.App.Properties.setString('acsUserID', user.id);
            // Set userID app property
            that.ACSuserCallback = user;
            params.success();
        } else {
            params.error({
                message: "ACS_PH error creating a new user: " + JSON.stringify(e)
            });
        }
    }

};

/**
 * Login the specificd user to ACS
 * @param  {object} params login a user with default system devicetoken and hash password or user supplied credentials
 * @return {void}
 */
ACSpush.prototype.loginUserToACS = function (params) {
    var that = this,
        pw, login;
    this.checkCallbacks(params, "loginUserToACS()");

    login = (params.login !== undefined) ? params.login : this.deviceToken;
    // Currently uses an MD5 hash of the username as the password, should have a way to overide this
    pw = (params.pw !== undefined) ? params.pw : Ti.Utils.md5HexDigest(this.deviceToken).slice(0, 20);

    // Network check prior to making the ACS call
    if (!this.checkNetwork()) {
        log("ERROR", "Network Error Check");
        params.error({
            message: "Could not fire Cloud.Users.login in loginUserToACS() ACS_PH - due to network issue"
        });
        return false;
    }

    Cloud.Users.login({
        login: login,
        password: pw
    }, loginCallback);

    function loginCallback(e) {
        if (e.success) {
            that.loggedInToACS = true;
            that.createNewUser = false;
            var user = e.users[0];

            log("WARN", 'Success loggin user in: ' + 'id: ' + user.id + ' ' + 'username: ' + user.username + ' ');
            Ti.App.Properties.setString('acsUserID', user.id);
            // Set userID app property
            that.ACSuserCallback = user;
            params.success(e);
        } else {
            params.error({
                message: "ACS_PH error logging in user: " + JSON.stringify(e)
            });
        }
    }
};

/**
 * Subscribe current device to a specific channel
 * @param {object} params Subscirption properties
 * @param {string} params.channel - Channel to subscribe user to
 * @param {string} params.deviceToken - Device Token passed in
 */
ACSpush.prototype.subscribeToPush = function (params) {
    var that = this,
        pnt = false;
    this.checkCallbacks(params, "subscribeToPush()");

    if (params.channel === undefined) {
        params.channel = defaultChannelName;
    }

    // Android Devices need to enable with alternative module, this needs its own method
    if (ANDROID) {
        // TODO custom configuration for android required.
        CloudPush.enabled = true;
        CloudPush.setShowTrayNotification = true;
    }

    // Network check prior to making the ACS call
    if (!this.checkNetwork()) {
        log("ERROR", "Network Error Check");
        params.error({
            message: "Could not fire Cloud.PushNotifications.subscribe in subscribeToPush() ACS_PH - due to network issue"
        });
        return false;
    }

    Cloud.PushNotifications.subscribe({
        channel: params.channel,
        device_token: this.deviceToken,
        type: (ANDROID) ? 'android' : 'ios'
    }, pushSubscribeCallback);

    function pushSubscribeCallback(e) {
        if (e.success) {
            log("INFO", 'Successfullly Subscribed to ACS Push Channel');
            log("DEBUG", JSON.stringify(e));
            that.subscribeToPushResponse = e;
            that.subscribedChannels = that.returnSubscribedChannels();
            var len = that.subscribedChannels.length,
                i;
            for (i = 0; i < len; i += 1) {
                if (that.subscribedChannels[i].channel === params.channel) {

                    log("WARN", '** SUBSCRIBE Looping channel list property  ');
                    pnt = true;
                    that.subscribedChannels[i].state = true;
                    Ti.App.Properties.setList('subscribedChannels', that.subscribedChannels);
                }
                if (i === len - 1 && !pnt) {
                    log("WARN", '** SUBSCRIBE Could not find key, asuming new channel being added:' + params.channel);
                    that.subscribedChannels.push({
                        channel: params.channel,
                        state: true
                    });
                    Ti.App.Properties.setList('subscribedChannels', that.subscribedChannels);
                }
            }
            log("DEBUG", JSON.stringify(Ti.App.Properties.getList('subscribedChannels')));
            params.success();
        } else {
            params.error({
                message: "ACS_PH error subscribing to channel: " + JSON.stringify(e)
            });
        }
    }
};


/**
 * Helper method to get a list & state of persistent push channels in the ACS system
 * @return {object} Array of channels and subscription state of them
 */
ACSpush.prototype.returnSubscribedChannels = function () {
    Ti.API.info('Return list of subscribed channels from persistent memory');
    var list = Ti.App.Properties.getList('subscribedChannels');
    return list;
};


ACSpush.prototype.returnDeviceToken = function () {
    "use strict";
    Ti.API.warn('Device Token:  ' + this.deviceToken);
    return this.deviceToken;
};



ACSpush.prototype.deleteDeviceToken = function () {
    "use strict";
    Ti.API.warn('Removing Device Token value from App Proerpty:  ');
    Ti.App.Properties.removeProperty('deviceToken');
    return;
};

/**
 * Checks the device Persistent data store to see if this device has registered with Push Device servers,
 * and if subscribed to the push notification ACS system.
 */
ACSpush.prototype.deviceTokenCheck = function () {
    var deviceToken = Ti.App.Properties.getString('deviceToken'),
        deviceTokenCheck;
    Ti.API.info('value of deviceToken :' + deviceToken);
    if (deviceToken === null || deviceToken === undefined || !deviceToken) {
        Ti.API.info('Device token not previously stored');
        // Attempt to get new device Token

        deviceTokenCheck = false;
    } else {
        this.deviceToken = deviceToken;
        deviceTokenCheck = true;
    }
    Ti.API.info('value of deviceTokenCheck :' + deviceTokenCheck);
    // when device token retrieved and push subscribed - then set pushSubscription.

    // console.log("Checking Device");
    // Check the device App Property for previous tag
    // get deviceToken value
    // get loggedIntoACS value
    return deviceTokenCheck;
};



// Incomplete, untested methods
// *** DO NOT USE THESE YET ***
// 
// 


ACSpush.prototype.logUserOutOfACS = function () {
    var that = this;
    Cloud.Users.logout(function (e) {
        Ti.API.info(e);
        if (e.success) {
            that.loggedInToACS = false;
            Ti.API.warn('Logged User out of ACS');
        }
    });
};


/**
 * Unsubscribe current device from a specific channel
 * @param {Object} params Subscirption properties
 * @param {String} params.channel - Channel to subscribe user to
 * @param {String} params.deviceToken - Device Token passed in
 */
ACSpush.prototype.unsubscribePushChannel = function (params) {
    "use strict";
    var that = this,
        pnt = false;
    Ti.API.info(JSON.stringify(params) + ' passed into method');
    if (params.channel === undefined) {
        params.channel = 'general';
    }

    Cloud.PushNotifications.unsubscribe({
        channel: params.channel,
        device_token: this.deviceToken,
        type: (ANDROID) ? 'android' : 'ios'
    }, function (f) {
        if (f.success) {
            Ti.API.warn('Unsubscribed Push Notification from Channel: ' + JSON.stringify(f));
            that.unsubscribeToPushResponse = f;
            that.subscribedChannels = that.returnSubscribedChannels();
            var l = that.subscribedChannels.length,
                i;
            for (i = 0; i < l; i += 1) {
                Ti.API.warn('Loop: ' + i + ' of ' + l);
                if (that.subscribedChannels[i].channel === params.channel) {
                    Ti.API.warn('** UNSUBSCRIBE CHANNEL - Looping channel list property');
                    pnt = true;
                    that.subscribedChannels[i].state = false;
                    Ti.App.Properties.setList('subscribedChannels', that.subscribedChannels);
                }
                if (i === l - 1 && !pnt) {
                    Ti.API.warn('** UNSUBSCRIBE CHANNEL - Could not find key, asuming new channel being added:' + params.channel);
                    that.subscribedChannels.push({
                        channel: params.channel,
                        state: false
                    });
                    Ti.App.Properties.setList('subscribedChannels', that.subscribedChannels);
                }
            }

        } else {
            Ti.API.error('Error:\n' + ((f.error && f.message) || JSON.stringify(f)))
        }
    });
    return;
};
/**
 * Send push notifications out through the ACS system, payload and limitations
 * @param {Object} params paramateres for payload and push properties
 * @param {String} params.channel - channel to send out to
 * @param {String} params.payload - the payload data to send through the
 * @param {String} params.to_ids - Comma separated user ids of who to send push notification to , if subscribed to the specified channel.
 */
ACSpush.prototype.sendPushNotification = function (params) {
    // this.checkIfLoggedIn();
    var that = this;
    // Check if the payload is correctly setup
    Cloud.PushNotifications.notify({
        channel: params.channel || "general", // choose the general channel if no specific channel setup
        to_ids: params.to_ids,
        payload: params.payload
    }, function (e) {
        if (e.success) {
            Ti.API.warn('Success in posting push notice');
        } else {
            Ti.API.error('Callback Error:\\n' + ((e.error && e.message) || JSON.stringify(e)));
        }
        that.notifyResponse = e;
    });

};
exports.ACSpush = ACSpush;