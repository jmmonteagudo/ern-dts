namespace demo.products;

entity Products {
  key ID       : UUID;
  name         : String(100) @mandatory;
  category     : String(50);
  price        : Decimal(10,2);
  stock        : Integer;
  status       : String(20) enum { available; discontinued; low_stock };
  supplier     : String(100);
  lastUpdated  : Timestamp @cds.on.update: $now;
  virtual stockCriticality : Integer;
  auditTrail   : Composition of many AuditLog on auditTrail.product_ID = $self.ID;
}

entity AuditLog {
  key ID         : UUID;
  product_ID    : UUID;
  entity_name   : String(50);
  entity_id     : String(36);
  action        : String(10) enum { CREATE; UPDATE; DELETE };
  field         : String(50);
  oldValue      : String(255);
  newValue      : String(255);
  user          : String(100);
  timestamp     : Timestamp @cds.on.insert: $now;
}
