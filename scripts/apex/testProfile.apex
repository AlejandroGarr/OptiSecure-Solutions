// Test getUserProfileData as the first community user
Id communityUserId = '005gK00002aFfn7QAC'; // Juan Garcia Martín
UserMenuController.UserProfileData result = UserMenuController.getUserProfileData();
System.debug('=== RESULT NAME: ' + result.name);
System.debug('=== RESULT EMAIL: ' + result.email);
System.debug('=== RESULT ACCOUNT: ' + result.accountName);
System.debug('=== RESULT CAMERAS: ' + result.totalCameras);
System.debug('=== RESULT ADMIN: ' + result.isAdmin);
System.debug('=== RESULT INITIALS: ' + result.initials);
