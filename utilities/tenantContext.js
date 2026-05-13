const { AsyncLocalStorage } = require('async_hooks');

const tenantLocalStorage = new AsyncLocalStorage();

const getTenantId = () => {
  const store = tenantLocalStorage.getStore();
  return store ? store.companyId : null;
};

const runWithTenant = (companyId, callback) => {
  return tenantLocalStorage.run({ companyId }, callback);
};

module.exports = {
  getTenantId,
  runWithTenant,
};
