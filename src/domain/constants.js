const contract = require('../../contract.json');

const ENUMS = contract.enums;
const PIPELINE_STAGES = contract.pipelineStages;
const USER_FACING_MESSAGES = contract.userFacingMessages;
const DEMO_ACCOUNTS = contract.demoAccounts;
const ENTITIES = contract.entities;

module.exports = {
  ENUMS,
  PIPELINE_STAGES,
  USER_FACING_MESSAGES,
  DEMO_ACCOUNTS,
  ENTITIES
};
