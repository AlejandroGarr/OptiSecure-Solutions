List<Case> cases = [SELECT Id FROM Case LIMIT 200];
System.debug('Cases encontrados: ' + cases.size());
if (!cases.isEmpty()) {
    delete cases;
    Database.emptyRecycleBin(cases);
}
System.debug('Cases borrados y papelera vaciada');
