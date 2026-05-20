using { demo.products as db } from '../db/schema';

service ProductService @(path: '/api') {
  entity Products as projection on db.Products;
  @readonly entity AuditLog as projection on db.AuditLog;

  action flagLowStock(ids: array of UUID) returns String;

  type RestockSuggestion {
    productID      : UUID;
    currentStock   : Integer;
    suggestedOrder : Integer;
    reason         : String;
    confidence     : Decimal(3,2);
    model          : String;
    groundingDocs  : array of String;
  }

  action suggestRestock(ids: array of UUID) returns array of RestockSuggestion;
}
