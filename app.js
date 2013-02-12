// Ti.API.info('Starting ACS start up process - getting device token')
 if (Ti.Properties.getBool('acs-init')) {
	Ti.API.warn('********* ACS login already initialised ******** ');
	return;
 }
 Ti.Properties.setBool('acs-init', true);
 var acs_ph = require('/modules/ACS_Push_Helper');
 var ACS = new acs_ph.ACSpush();
 /**
  * First checking to see if the user is logged into Appcelerator Cloud Services.
  */
 ACS.showLoggedInACSuser();
 /**
  * Performs checks to see if the device has a token and if not creates one, storing the value 
  * into persistent storage.
  */
 ACS.getDeviceToken();
 ACS.deviceToken = Ti.App.Properties.getString('deviceToken');


 /**
  * Timeout Loop block - checks to see if the logged in state is true, after a small delay for network check,
  * this ideally needs to be asynchronous, but the code will need refactoring for that
  */


 setTimeout(function() {
     if (!ACS.loggedInToACS) {
         Ti.API.warn('********* This device is NOT Logged into ACS ******** ');
         Ti.API.warn('********* About to Query ACS userbase against this device ******** ');
         ACS.queryNewACSuser({
			username : ACS.deviceToken,
			callback : function(){
				alert('Create a new user? ' + ACS.createNewUser)
			}
         });

         setTimeout(function() {
             if(ACS.createNewUser){
                 Ti.API.warn('********* Need to create a new ACS user account: '+ ACS.createNewUser+' ******** ');
                 ACS.createUserAccount();
             }

             setTimeout(function() {
                 Ti.API.warn('Login to ACS - ' + ACS.createNewUser);
                 ACS.loginUserToACS();
             }, 4000);
         }, 5400);
     } else {
         Ti.API.warn('********* USer Logged IN true - no need to create new account ******** ');
     }
 }, 4000);
