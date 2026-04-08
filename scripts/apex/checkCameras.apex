List<Camara__c> cams = [SELECT Id, Name, Contact__c, Contact__r.Name FROM Camara__c];
for (Camara__c c : cams) {
    System.debug('CAM: ' + c.Name + ' -> ContactId: ' + c.Contact__c + ' ContactName: ' + (c.Contact__r != null ? c.Contact__r.Name : 'NULL'));
}
