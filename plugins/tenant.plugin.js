const { getTenantId } = require('../utilities/tenantContext');

const tenantPlugin = function (schema, options) {
  // If a schema shouldn't have multi-tenancy, pass options.skipTenant = true
  // OR if the schema doesn't even have a companyId field, skip it.
  if ((options && options.skipTenant) || !schema.path('companyId')) return;

  const scopeQuery = async function () {
    const companyId = getTenantId();
    if (companyId) {
      // Add companyId to the query conditions
      this.where({ companyId });
    }
  };

  const scopeDocument = async function () {
    const companyId = getTenantId();
    if (companyId) {
      if (!this.companyId) {
        this.companyId = companyId;
      }
    }
  };

  // Queries
  schema.pre('find', scopeQuery);
  schema.pre('findOne', scopeQuery);
  schema.pre('findOneAndUpdate', scopeQuery);
  schema.pre('count', scopeQuery);
  schema.pre('countDocuments', scopeQuery);
  schema.pre('deleteMany', scopeQuery);
  schema.pre('deleteOne', scopeQuery);
  schema.pre('findOneAndDelete', scopeQuery);
  schema.pre('findOneAndRemove', scopeQuery);
  schema.pre('update', scopeQuery);
  schema.pre('updateOne', scopeQuery);
  schema.pre('updateMany', scopeQuery);

  // Documents
  schema.pre('save', scopeDocument);
  
  schema.pre('insertMany', async function (docs) {
    const companyId = getTenantId();
    if (companyId) {
      if (Array.isArray(docs)) {
        docs.forEach(doc => {
          if (!doc.companyId) doc.companyId = companyId;
        });
      }
    }
  });
};

module.exports = tenantPlugin;
