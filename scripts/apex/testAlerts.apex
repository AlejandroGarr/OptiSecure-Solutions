try {
    List<SecurityClipController.AlertInfo> alerts = SecurityClipController.getRecentAlerts();
    System.debug('Alerts count: ' + alerts.size());
    for (SecurityClipController.AlertInfo a : alerts) {
        System.debug('Alert: ' + a.subject + ' | URL: ' + a.clipUrl);
    }
} catch (Exception e) {
    System.debug('ERROR: ' + e.getMessage());
    System.debug('STACK: ' + e.getStackTraceString());
}
