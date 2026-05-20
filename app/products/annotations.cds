using ProductService as service from '../../srv/service';

// Criticality calculation for stock levels
annotate service.Products with {
  stock @Common.Label: 'Stock Level';
  status @Common.Label: 'Status';
  name @Common.Label: 'Product Name';
  category @Common.Label: 'Category';
  price @Common.Label: 'Price';
  supplier @Common.Label: 'Supplier';
};

annotate service.Products with @UI: {
  HeaderInfo: {
    TypeName: 'Product',
    TypeNamePlural: 'Products',
    Title: { Value: name },
    Description: { Value: category }
  },

  SelectionFields: [ category, status, supplier ],

  LineItem: [
    { Value: name },
    { Value: category },
    { Value: price },
    {
      Value: stock,
      Criticality: stockCriticality
    },
    {
      Value: status,
      Criticality: stockCriticality
    },
    { Value: supplier },
    {
      $Type: 'UI.DataFieldForAction',
      Action: 'ProductService.suggestRestock',
      Label: '{i18n>action.suggestRestock}'
    },
    {
      $Type: 'UI.DataFieldForAction',
      Action: 'ProductService.flagLowStock',
      Label: '{i18n>action.flagLowStock}'
    }
  ],

  HeaderFacets: [
    {
      $Type: 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#StockLevel'
    },
    {
      $Type: 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#Price'
    }
  ],

  DataPoint #StockLevel: {
    Value: stock,
    Title: 'Stock Level',
    Criticality: stockCriticality
  },

  DataPoint #Price: {
    Value: price,
    Title: 'Unit Price'
  },

  FieldGroup #General: {
    Data: [
      { Value: name },
      { Value: category },
      { Value: supplier },
      { Value: lastUpdated }
    ]
  },

  FieldGroup #Inventory: {
    Data: [
      { Value: price },
      { Value: stock },
      { Value: status, Criticality: stockCriticality }
    ]
  },

  Facets: [
    { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#General', Label: 'General' },
    { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#Inventory', Label: 'Inventory' },
    { $Type: 'UI.ReferenceFacet', Target: 'auditTrail/@UI.LineItem', Label: 'Audit History' }
  ]
};

// Virtual element for stock criticality
annotate service.Products with {
  stockCriticality @UI.Hidden;
};

// Audit Log table in Object Page
annotate service.AuditLog with @UI: {
  LineItem: [
    { Value: timestamp, Label: 'When' },
    { Value: action, Label: 'Action' },
    { Value: field, Label: 'Field' },
    { Value: newValue, Label: 'New Value' },
    { Value: user, Label: 'User' }
  ]
};
