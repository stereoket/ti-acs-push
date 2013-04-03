// Ti.API.info('Starting ACS start up process - getting device token')
// if (Ti.App.Properties.getBool('acs-init')) {
// Ti.API.WARN('********* ACS login already initialised ******** ');
// break;
// }

Ti.App.Properties.setBool('acs-init', true);
var acs_ph = require('/modules/ACS_Push_Helper');
var ACS = new acs_ph.ACSpush();
var configs = require('/modules/Config');
var log = configs.log;

function subscribeToChannel(e) {
    log("WARN", "   subscribeToChannel() ");
    try {
        ACS.subscribeToPush({
            channel: 'general',
            success: function(e){
                alert("success, push is now setup: put your method here")
            },
            error: acsErrorManager
        });
    } catch (err) {
        log("ERROR", "Error subscribing to channel with ACS: " + err.name + ":" + err.message);
    }
}

function loginUser() {
    log("WARN", '  loginUser()  ');
    if (!ACS.createNewUser) {
        try {
            ACS.loginUserToACS({
                success: subscribeToChannel,
                error: acsErrorManager
            });
        } catch (err) {
            log("ERROR", "Error logging in user with ACS: " + err.name + ":" + err.message);
        }
    }
};

// probably needs renaming

function createUser() {
    log("WARN", '  createUser()  ');

    if (ACS.createNewUser) {
        log("INFO", '  Need to create a new ACS user account: ');
        try {
            ACS.createUserAccount({
                success: loginUser,
                error: acsErrorManager
            });
        } catch (err) {
            log("error", "Error Creating new user with ACS: " + err.name + ":" + err.message);
        }
    } else {
        loginUser();
    }
};

function loginCallback() {
    log("WARN", '  loginCallback()  ');
    ACS.deviceToken = Ti.App.Properties.getString('deviceToken');
    /**
     * Checks to see if the logged in state is true, after a small delay for network check,
     * this ideally needs to be asynchronous, but the code will need refactoring for that
     */
    if (!ACS.loggedInToACS) {
        log("WARN", '  This device is NOT Logged into ACS  ');
        log("WARN", '  About to Query ACS userbase against this device  ');
        try {
            ACS.queryNewACSuser({
                username: ACS.deviceToken,
                success: createUser,
                error: acsErrorManager
            });
        } catch (err) {
            log("error", "Error Querying new user with ACS: " + err.name + ":" + err.message);
        }
    } else {
        log("WARN", ' ********* User Logged IN true - no need to create new account ******** ');
    }
};

function getDeviceToken() {
    /**
     * Performs checks to see if the device has a token and if not creates one, storing the value
     * into persistent storage.
     */
    try {
        ACS.getDeviceToken({
            success: loginCallback,
            error: acsErrorManager
        });
    } catch (err) {
        log("error", "Error Getting Device token: " + err.name + ":" + err.message);
    }

};

function acsErrorManager(evt) {
    log("ERROR", ' ********* ERROR CALLBACK ******** ');
    log("DEBUG", JSON.stringify(evt));
}
/**
 * First checking to see if the user is logged into Appcelerator Cloud Services.
 */
try {
    ACS.login({
        success: getDeviceToken,
        error: acsErrorManager
    });
} catch (err) {
    Ti.API.error("Error in the initial ACS login sequence: " + err.name + ":" + err.message);
}