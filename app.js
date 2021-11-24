/*
 * Copyright 2021 @OpenAdvice
 * Author: Dominic Lehr
/*
 * --------------------------------------------------------------------------------
 * Description: Main Module for the topology observer
 *        TODO:
 * --------------------------------------------------------------------------------
 */

const cron = require('node-cron');
const axios = require('axios');
const oracledb = require('oracledb');

const { getCurrentDate, validateIPaddress } = require('./helperFunctions');

// topologyid:_id
let entitiesInAsm = {};
let topologyData = {};
// tpologyid:nodeid
let topologyRelationData = {};
// nodeid:uniqueId
let nodesInAsm = {};

/******************* CONFIGURATION *******************/
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
console.log(getCurrentDate() + ' Starting topology collector...');

let TOPO_DB_QUERY_FIELDS = process.env.TOPO_DB_QUERY_FIELDS;
if (!TOPO_DB_QUERY_FIELDS) {
  TOPO_DB_QUERY_FIELDS = 'TOPOLOGYID,TOPOLOGY_NAME,TOPOLOGY_TYPE';
}

let TOPO_DB_NAME = process.env.TOPO_DB_NAME;
if (!TOPO_DB_NAME) {
  TOPO_DB_NAME = 'V_TOPOLOGY';
}

let TOPO_DB_QUERY_SQL = process.env.TOPO_DB_QUERY_SQL;
if (!TOPO_DB_QUERY_SQL) {
  TOPO_DB_QUERY_SQL = 'select __TOPO_DB_QUERY_FIELDS__ from __TOPO_DB_NAME__';
}

TOPO_DB_QUERY_SQL = TOPO_DB_QUERY_SQL.replace('__TOPO_DB_QUERY_FIELDS__', TOPO_DB_QUERY_FIELDS);
TOPO_DB_QUERY_SQL = TOPO_DB_QUERY_SQL.replace('__TOPO_DB_NAME__', TOPO_DB_NAME);

console.log(`Using query <${TOPO_DB_QUERY_SQL}> to query topology database...`);

let TOPO_REL_DB_QUERY_FIELDS = process.env.TOPO_REL_DB_QUERY_FIELDS;
if (!TOPO_REL_DB_QUERY_FIELDS) {
  TOPO_REL_DB_QUERY_FIELDS = 'TOPOLOGYID,NODEID';
}

let TOPO_REL_DB_NAME = process.env.TOPO_REL_DB_NAME;
if (!TOPO_REL_DB_NAME) {
  TOPO_REL_DB_NAME = 'INVENTORY';
}

let TOPO_REL_DB_QUERY_SQL = process.env.TOPO_REL_DB_QUERY_SQL;
if (!TOPO_REL_DB_QUERY_SQL) {
  TOPO_REL_DB_QUERY_SQL = 'select __TOPO_REL_DB_QUERY_FIELDS__ from __TOPO_REL_DB_NAME__';
}

TOPO_REL_DB_QUERY_SQL = TOPO_REL_DB_QUERY_SQL.replace('__TOPO_REL_DB_QUERY_FIELDS__', TOPO_REL_DB_QUERY_FIELDS);
TOPO_REL_DB_QUERY_SQL = TOPO_REL_DB_QUERY_SQL.replace('__TOPO_REL_DB_NAME__', TOPO_REL_DB_NAME);

console.log(`Using query <${TOPO_REL_DB_QUERY_SQL}> to query topology relations database...`);

let TOPO_DB_CON = process.env.TOPO_DB_CON;
if (!TOPO_DB_CON) {
  console.error('Missing env variable TOPO_DB_CON! Using default...');
  TOPO_DB_CON = '127.0.0.1:1521/XE';
}

let TOPO_DB_USER = process.env.TOPO_DB_USER;
if (!TOPO_DB_USER) {
  console.error('Missing env variable TOPO_DB_USER! Using default...');
  TOPO_DB_USER = 'sunrise';
}

let TOPO_DB_PW = process.env.TOPO_DB_PW;
if (!TOPO_DB_PW) {
  console.error('Missing env variable TOPO_DB_PW! Using default...');
  TOPO_DB_PW = 'oadvice';
}

let ASM_BASE_URL = process.env.ASM_BASE_URL;
if (!ASM_BASE_URL) {
  console.error('Missing env variable ASM_BASE_URL! Using default...');
  ASM_BASE_URL = 'https://192.168.12.226/1.0/rest-observer/rest/';
}

let ASM_TOPO_URL = process.env.ASM_TOPO_URL;
if (!ASM_TOPO_URL) {
  console.error('Missing env variable ASM_TOPO_URL! Using default...');
  ASM_TOPO_URL = 'https://192.168.12.226/1.0/topology/';
}

let ASM_USER = process.env.ASM_USER;
if (!ASM_USER) {
  console.error('Missing env variable ASM_USER! Using default...');
  ASM_USER = 'asm';
}

let ASM_PASS = process.env.ASM_PASS;
if (!ASM_PASS) {
  console.error('Missing env variable ASM_PASS! Using default...');
  ASM_PASS = 'asm';
}

let ASM_TENANT_ID = process.env.ASM_TENANT_ID;
if (!ASM_TENANT_ID) {
  console.error('Missing env variable ASM_TENANT_ID! Using default...');
  ASM_TENANT_ID = 'cfd95b7e-3bc7-4006-a4a8-a73a79c71255';
}

let ASM_EP_JOB_ID = process.env.ASM_EP_JOB_ID;
if (!ASM_EP_JOB_ID) {
  console.error('Missing env variable ASM_EP_JOB_ID! Using default...');
  ASM_EP_JOB_ID = 'snr_inventory';
}

let ASM_EP_RES = process.env.ASM_EP_RES;
if (!ASM_EP_RES) {
  console.error('Missing env variable ASM_EP_RES! Using default...');
  ASM_EP_RES = 'resources';
}

let ASM_EP_RES_FLT = process.env.ASM_EP_RES_FLT;
if (!ASM_EP_RES_FLT) {
  console.error('Missing env variable ASM_EP_RES_FLT! Using default...');
  ASM_EP_RES_FLT =
    '?_filter=entityTypes%3DnetworkDevice&_limit=__LIMIT__&_offset=__OFFSET__&_sort=+uniqueId&_field=uniqueId&_include_global_resources=false&_include_count=false&_include_status=false&_include_status_severity=false&_include_metadata=false&_return_composites=true';
}

let ASM_EP_REF = process.env.ASM_EP_REF;
if (!ASM_EP_REF) {
  console.error('Missing env variable ASM_EP_REF! Using default...');
  ASM_EP_REF = 'references';
}

let ASM_EP_REF_DEL = process.env.ASM_EP_REF_DEL;
if (!ASM_EP_REF_DEL) {
  console.error('Missing env variable ASM_EP_REF_DEL! Using default...');
  ASM_EP_REF_DEL = '/references/out/contains?_delete=nodes&_delete_self=false';
}

let ASM_EP_RES_CNT = process.env.ASM_EP_RES_CNT;
if (!ASM_EP_RES_CNT) {
  console.error('Missing env variable ASM_EP_RES_CNT! Using default...');
  ASM_EP_RES_CNT =
    '?_filter=entityTypes%3DnetworkDevice&_limit=1&_include_global_resources=false&_include_count=true&_include_status=false&_include_status_severity=false&_include_metadata=false&_return_composites=true';
}

let ASM_EP_RES_NODE_CNT = process.env.ASM_EP_RES_NODE_CNT;
if (!ASM_EP_RES_NODE_CNT) {
  console.error('Missing env variable ASM_EP_RES_NODE_CNT! Using default...');
  ASM_EP_RES_NODE_CNT =
    '?_filter=entityTypes%3DnetworkDevice&_limit=1&_include_global_resources=false&_include_count=true&_include_status=false&_include_status_severity=false&_include_metadata=false&_return_composites=true';
}

let ASM_EP_RES_NODE_FLT = process.env.ASM_EP_RES_NODE_FLT;
if (!ASM_EP_RES_NODE_FLT) {
  console.error('Missing env variable ASM_EP_RES_NODE_FLT! Using default...');
  ASM_EP_RES_NODE_FLT =
    '?_filter=entityTypes%3DnetworkDevice&_limit=__LIMIT__&_offset=__OFFSET__&_sort=+uniqueId&_field=nodeid&_field=uniqueId&_include_global_resources=false&_include_count=false&_include_status=false&_include_status_severity=false&_include_metadata=false&_return_composites=true';
}

let DELETE_IF_NOT_PRESENT_IN_INV = process.env.DELETE_IF_NOT_PRESENT_IN_INV == 'true' ? true : false;
if (typeof DELETE_IF_NOT_PRESENT_IN_INV === 'undefined') {
  console.error('Missing env variable DELETE_IF_NOT_PRESENT_IN_INV! Using default...');
  DELETE_IF_NOT_PRESENT_IN_INV = true;
}

let ASM_EP_RES_DEL_IMMEDIATE = process.env.ASM_EP_RES_DEL_IMMEDIATE == 'true' ? true : false;
if (typeof ASM_EP_RES_DEL_IMMEDIATE === 'undefined') {
  console.error('Missing env variable ASM_EP_RES_DEL_IMMEDIATE! Using default...');
  ASM_EP_RES_DEL_IMMEDIATE = true;
}

let ASM_EP_DEL_WAIT_TIME_MS = process.env.ASM_EP_DEL_WAIT_TIME_MS;
if (!ASM_EP_DEL_WAIT_TIME_MS) {
  console.error('Missing env variable ASM_EP_DEL_WAIT_TIME_MS! Using default...');
  ASM_EP_DEL_WAIT_TIME_MS = 6000;
} else {
  ASM_EP_DEL_WAIT_TIME_MS = parseInt(ASM_EP_DEL_WAIT_TIME_MS);
}

let ASM_BATCH_SIZE = process.env.ASM_BATCH_SIZE;
if (!ASM_BATCH_SIZE) {
  console.error('Missing env variable ASM_BATCH_SIZE! Using default...');
  ASM_BATCH_SIZE = 1000;
} else {
  ASM_BATCH_SIZE = parseInt(ASM_BATCH_SIZE);
}

let ASM_EP_RES_DEL_IMMEDIATE_PARAM = process.env.ASM_EP_RES_DEL_IMMEDIATE_PARAM;
if (!ASM_EP_RES_DEL_IMMEDIATE_PARAM) {
  console.error('Missing env variable ASM_EP_RES_DEL_IMMEDIATE_PARAM! Using default...');
  ASM_EP_RES_DEL_IMMEDIATE_PARAM = '?_immediate=true';
}

let ASM_ENTITY_TYPE = process.env.ASM_ENTITY_TYPE;
if (!ASM_ENTITY_TYPE) {
  console.error('Missing env variable ASM_ENTITY_TYPE! Using default...');
  ASM_ENTITY_TYPE = 'networkDevice';
}

ASM_EP_RES_FLT = ASM_EP_RES_FLT.replace('__ASM_ENTITY_TYPE__', ASM_ENTITY_TYPE);
ASM_EP_RES_CNT = ASM_EP_RES_CNT.replace('__ASM_ENTITY_TYPE__', ASM_ENTITY_TYPE);

let ASM_RESPONSE_TIMEOUT = process.env.ASM_RESPONSE_TIMEOUT;
if (!ASM_RESPONSE_TIMEOUT) {
  console.error('Missing env variable ASM_RESPONSE_TIMEOUT! Using default...');
  ASM_RESPONSE_TIMEOUT = 10000;
} else {
  ASM_RESPONSE_TIMEOUT = parseInt(ASM_RESPONSE_TIMEOUT);
}

const token = Buffer.from(`${ASM_USER}:${ASM_PASS}`, 'utf8').toString('base64');

/***************** END CONFIGURATION *******************/

//schedule a periodic run
cron.schedule(process.env.SCHEDULE || '*/30 * * * *', () => {
  console.log(getCurrentDate() + '  Looking for new topology data in inventory database...');
  collectTopologyData(TOPO_DB_QUERY_SQL, TOPO_DB_QUERY_FIELDS, false)
    .then((data) => {
      console.log(getCurrentDate() + ` Done collectiong topology data.`);
      topologyData = data;
      collectTopologyData(TOPO_REL_DB_QUERY_SQL, TOPO_REL_DB_QUERY_FIELDS, true)
        .then((data) => {
          console.log(getCurrentDate() + ` Done collectiong topology relation data.`);
          topologyRelationData = data;
          console.log(
            getCurrentDate() + ` Collecting current ressources from ASM, using filter on type <${ASM_ENTITY_TYPE}>`
          );
          getAsmRessourceCount(ASM_TOPO_URL, ASM_EP_RES, ASM_EP_RES_CNT)
            .then((cnt) => {
              getFromAsm(cnt, ASM_EP_RES_FLT, false)
                .then((data) => {
                  entitiesInAsm = data;
                  getAsmRessourceCount(ASM_TOPO_URL, ASM_EP_RES, ASM_EP_RES_NODE_CNT)
                    .then((cnt) => {
                      getFromAsm(cnt, ASM_EP_RES_NODE_FLT, true)
                        .then((data) => {
                          nodesInAsm = data;
                          syncAsm()
                            .then(() => {
                              sendToAsm()
                                .then(() => {
                                  console.log(getCurrentDate() + ` Topology collector completed a run.`);
                                })
                                .catch((err) => console.log(err));
                            })
                            .catch((err) => console.log(err));
                        })
                        .catch((err) => console.log(err));
                    })
                    .catch((err) => console.log(err));
                })
                .catch((err) => console.log(err));
            })
            .catch((err) => console.log(err));
        })
        .catch((err) => console.log(err));
    })
    .catch((err) => console.log(err));
});

// collectTopologyData(TOPO_DB_QUERY_SQL, TOPO_DB_QUERY_FIELDS, false)
//   .then((data) => {
//     console.log(getCurrentDate() + ` Done collectiong topology data.`);
//     topologyData = data;
//     collectTopologyData(TOPO_REL_DB_QUERY_SQL, TOPO_REL_DB_QUERY_FIELDS, true)
//       .then((data) => {
//         console.log(getCurrentDate() + ` Done collectiong topology relation data.`);
//         topologyRelationData = data;
//         getAsmRessourceCount(ASM_TOPO_URL, ASM_EP_RES, ASM_EP_RES_CNT)
//           .then((cnt) => {
//             getFromAsm(cnt, ASM_EP_RES_FLT, false)
//               .then((data) => {
//                 entitiesInAsm = data;
//                 getAsmRessourceCount(ASM_TOPO_URL, ASM_EP_RES, ASM_EP_RES_NODE_CNT)
//                   .then((cnt) => {
//                     getFromAsm(cnt, ASM_EP_RES_NODE_FLT, true)
//                       .then((data) => {
//                         nodesInAsm = data;
//                         syncAsm()
//                           .then(() => {
//                             sendToAsm()
//                               .then(() => {
//                                 console.log(getCurrentDate() + ` Topology collector completed a run.`);
//                               })
//                               .catch((err) => console.log(err));
//                           })
//                           .catch((err) => console.log(err));
//                       })
//                       .catch((err) => console.log(err));
//                   })
//                   .catch((err) => console.log(err));
//               })
//               .catch((err) => console.log(err));
//           })
//           .catch((err) => console.log(err));
//       })
//       .catch((err) => console.log(err));
//   })
//   .catch((err) => console.log(err));

async function collectTopologyData(query, fields, relations) {
  console.log(getCurrentDate() + ` Looking for new data using query <${query}>`);

  let tempTopologyData = {};

  return new Promise(async function (resolve, reject) {
    let connection;
    try {
      connection = await oracledb.getConnection({
        user: TOPO_DB_USER,
        password: TOPO_DB_PW,
        connectString: TOPO_DB_CON,
      });

      const result = await connection.execute(query, [], {
        resultSet: true,
      });

      if (result) {
        const rs = result.resultSet;
        let row;
        let i = 0;
        const topoFieldsArray = fields.split(',');
        while ((row = await rs.getRow())) {
          let topoEntry = {};
          for (const field of topoFieldsArray) {
            let val = '' + row[field.trim()];
            val = val.trim();
            val = val.replace(/(?:\r\n|\r|\n)/g, ' ');
            topoEntry[field.toLowerCase()] = val;
          }
          if (relations) {
            let arr_nodes = tempTopologyData[topoEntry.topologyid];
            if (arr_nodes && arr_nodes.length > 0) {
              arr_nodes.push(topoEntry.nodeid);
              tempTopologyData[topoEntry.topologyid] = arr_nodes;
            } else {
              tempTopologyData[topoEntry.topologyid] = [topoEntry.nodeid];
            }
          } else {
            tempTopologyData[topoEntry.topologyid] = topoEntry;
          }

          i++;
        }
        console.log(getCurrentDate() + ` Found ${i} rows in database.`);

        await rs.close();
        resolve(tempTopologyData);
      } else {
        console.error(getCurrentDate() + ' Did not get any results from database!');
        reject('Did not get any results from database!');
      }
    } catch (err) {
      console.error(getCurrentDate() + ' ' + err);
      reject(err);
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (err) {
          console.error(err);
        }
      }
    }
  });
}

async function getAsmRessourceCount(url, endpoint, endpointOptions) {
  return new Promise(function (resolve, reject) {
    console.log(
      getCurrentDate() +
        ` Collecting the total amount of ressources from ASM using URL ${url + endpoint + endpointOptions} ...`
    );
    try {
      axios
        .get(url + endpoint + endpointOptions, {
          headers: {
            Authorization: `Basic ${token}`,
            'X-TenantID': ASM_TENANT_ID,
          },
        })
        .then(
          (response) => {
            if (response && response.status && response.status < 400) {
              if (response.data && response.data._count >= 0) {
                const asmResCount = response.data._count;
                console.log(
                  getCurrentDate() + ` Done collecting total amount of ressources from ASM. Found ${asmResCount} items.`
                );
                resolve(asmResCount);
              } else {
                console.log(
                  getCurrentDate() +
                    ` Done collecting total amount of ressources from ASM. Found an unexpected count, returning 0.`
                );
                resolve(0);
              }
            }
          },
          (error) => {
            console.log(getCurrentDate() + ' Error collecting total amount of ressources from ASM.');
            console.log(error);
            if (error && error.response && error.response.data) {
              const errorData = error.response.data;
              if (errorData) {
                console.log(`Reason:`);
                console.log(errorData);
                reject(
                  getCurrentDate() +
                    'An Error occurred while collection total amount of ressources from ASM. Please see previous error messages.'
                );
              }
            }
          }
        );
    } catch (err) {
      console.log(getCurrentDate() + ' Caught an exception while collection total amount of ressources from ASM!');
      console.error(err);
      reject(
        getCurrentDate() +
          ' An Exception occurred while collection total amount of ressources from ASM. Please see previous error messages.'
      );
    }
  });
}

// gets a list of entities currently present in inventory and deletes the ressources
// in ASM if they are not present in inventory
// also removes the outgoing relations from every ressources so fresh ones can come in
async function syncAsm() {
  return new Promise(async function (resolve, reject) {
    console.log(getCurrentDate() + ' Synching topology data with ASM...');
    let count = 0;
    try {
      for (const [key, value] of Object.entries(entitiesInAsm)) {
        let presentInInventory = topologyData[key];
        if (!presentInInventory) {
          console.log(getCurrentDate() + ' Element <' + key + '> is not present in topology..');
          let asmElementInternalId = entitiesInAsm[key];
          if (asmElementInternalId) deleteFromAsm(key, asmElementInternalId);
        } else {
          try {
            await deleteReferenceFromAsm(value);
            count++;
            console.log(getCurrentDate() + ` Done deleting ressource relation #${count}.`);
          } catch (err) {
            console.log(getCurrentDate() + ' Caught an exception while deleting ressource relation.');
            console.error(err);
          }
        }
      }
      console.log(getCurrentDate() + ' Done synching topology data with ASM...');
      resolve();
    } catch (err) {
      console.log(getCurrentDate() + ' Caught an exception while synchronizing topology data with ASM!');
      console.error(err);
      reject(
        getCurrentDate() +
          'An Exception occurred while synchronizing topology data with ASM. Please see previous error message(s).'
      );
    }
  });
}

async function getFromAsm(totalRessourceCnt, filter, nodes) {
  let numApiCalls = Math.ceil(totalRessourceCnt / ASM_BATCH_SIZE);
  // let numApiCalls = 1;
  console.log(
    getCurrentDate() +
      ` Will be running ${numApiCalls} calls against the ASM API with a batch size of ${ASM_BATCH_SIZE} each.`
  );

  const staticUrlPart = ASM_TOPO_URL + ASM_EP_RES;
  let dynamicUrlPart = '';
  let executedCalls = 0;
  let asmEntries = {};

  while (executedCalls < numApiCalls) {
    dynamicUrlPart = filter.replace('__LIMIT__', ASM_BATCH_SIZE);
    dynamicUrlPart = dynamicUrlPart.replace('__OFFSET__', executedCalls * ASM_BATCH_SIZE);
    console.log(
      getCurrentDate() + ` Executing batch #${executedCalls + 1} using URL ${staticUrlPart + dynamicUrlPart}`
    );

    try {
      let response = await axios.get(staticUrlPart + dynamicUrlPart, {
        headers: {
          Authorization: `Basic ${token}`,
          'X-TenantID': ASM_TENANT_ID,
        },
      });
      if (response && response.status && response.status < 400) {
        if (response.data && response.data._items) {
          if (nodes) {
            for (let asmEle of response.data._items) {
              asmEntries[asmEle.nodeid] = asmEle.uniqueId;
            }
          } else {
            for (let asmEle of response.data._items) {
              asmEntries[asmEle.uniqueId] = asmEle._id;
            }
          }

          console.log(
            getCurrentDate() +
              ` Done collecting batched data from ASM. Found ${response.data._items.length} items in current batch.`
          );
        }
      }
      executedCalls++;
    } catch (err) {
      console.log(getCurrentDate() + ' Caught an exception while collection data from ASM!');
      console.error(err);
    }
  }

  console.log(getCurrentDate() + ` Done collecting ALL data from ASM. Found ${Object.keys(asmEntries).length} items.`);
  return asmEntries;
}

async function sendToAsm() {
  console.log(getCurrentDate() + ' Sending topology data to ASM...');
  let count = 1;
  for (const [key, ele] of Object.entries(topologyData)) {
    try {
      ele.entityTypes = [ASM_ENTITY_TYPE];
      ele.uniqueId = ele.topologyid;
      ele.name = ele.topology_name;
      count = count + 1;
      console.log(
        getCurrentDate() + ` Working on topology with topology ID ${ele.topologyid}. This is element #${count}.`
      );
      await sendSingleElementToAsm(ele, ASM_EP_RES);

      // build the runs on relations of this topology
      let arr_topoRelations = topologyRelationData[ele.topologyid];
      if (arr_topoRelations && arr_topoRelations.length > 0) {
        console.log(
          getCurrentDate() + ` Topology with topology ID ${ele.topologyid} runs on ${arr_topoRelations.length} nodes.`
        );
        for (const nodeid of arr_topoRelations) {
          const nodeUniqueId = nodesInAsm[nodeid];
          if (nodeUniqueId) {
            let topoRelation = {};
            topoRelation._fromUniqueId = ele.topologyid;
            topoRelation._toUniqueId = nodeUniqueId;
            topoRelation._edgeType = 'runsOn';
            try {
              await sendSingleElementToAsm(topoRelation, ASM_EP_REF);
            } catch (err) {
              console.log(getCurrentDate() + ' Caught an exception while sending relation data to ASM!');
              console.error(err);
            }
          }
        }
      }
    } catch (err) {
      console.log(getCurrentDate() + ' Caught an exception while sending data to ASM!');
      console.error(err);
    }
  }
  console.log(getCurrentDate() + ' Done Sending inventory data to ASM...');
}

async function sendSingleElementToAsm(ele, endpoint) {
  return new Promise(async function (resolve, reject) {
    try {
      axios
        .post(ASM_BASE_URL + endpoint, ele, {
          timeout: ASM_RESPONSE_TIMEOUT,
          headers: {
            Authorization: `Basic ${token}`,
            'X-TenantID': ASM_TENANT_ID,
            JobId: ASM_EP_JOB_ID,
          },
        })
        .then(
          (response) => {
            console.log(getCurrentDate() + ' Sent to asm... checking response (errors will be logged).');
            if (response.status && response.status >= 400) {
              console.log(
                getCurrentDate() +
                  ` Received an error response while creating a ressource in ASM. Ressource: ${ele.name}`
              );
              reject(`Received an error response while creating a ressource in ASM. Ressource: ${ele.name}`);
            } else {
              //console.log(getCurrentDate() + ' Successfully sent to ASM.');
              resolve();
            }
          },
          (error) => {
            console.log(getCurrentDate() + ' Error sending the following data to ASM:');
            console.log(ele);
            if (error && error.response && error.response.data) {
              const errorData = error.response.data;
              if (errorData) {
                console.log(getCurrentDate() + ` Reason:`);
                console.log(errorData);
              }
            }
            reject('Error sending data to ASM.');
          }
        );
    } catch (err) {
      console.log(getCurrentDate() + ' Caught an exception while sending data to ASM!');
      console.error(err);
      reject('Caught an exception while sending data to ASM!');
    }
  });
}

async function deleteFromAsm(uniqueId, asmInternalId) {
  if (uniqueId && typeof uniqueId != 'undefined' && uniqueId != 'undefined') {
    console.log(getCurrentDate() + ` About to delete ressource with uniqueId <${uniqueId}> from ASM...`);
    const uri = encodeURI(ASM_BASE_URL + ASM_EP_RES + '/' + uniqueId);
    axios
      .delete(uri, {
        headers: {
          Authorization: `Basic ${token}`,
          'X-TenantID': ASM_TENANT_ID,
          JobId: ASM_EP_JOB_ID,
        },
      })
      .then((response) => {
        if (response && response.status && response.status < 400) {
          console.log(getCurrentDate() + ` Done deleting ressource with uniqueId <${uniqueId}> from ASM...`);
          if (ASM_EP_RES_DEL_IMMEDIATE === true) {
            // the previous delete is async, we need to wait a moment until we finally delete the elemet for good
            console.log(getCurrentDate() + ' Waiting for ressource to be gone...');
            setTimeout(function () {
              console.debug(
                getCurrentDate() +
                  ` Deleting ressource with name <${uniqueId}> for good, using uniqueID <${asmInternalId}>`
              );
              const uri = encodeURI(ASM_TOPO_URL + ASM_EP_RES + '/' + asmInternalId + ASM_EP_RES_DEL_IMMEDIATE_PARAM);
              axios
                .delete(uri, {
                  headers: {
                    Authorization: `Basic ${token}`,
                    'X-TenantID': ASM_TENANT_ID,
                  },
                })
                .then((response) => {
                  if (response && response.status && response.status < 400) {
                    console.debug(
                      getCurrentDate() + ` Successfully deleted ressource with name: ${uniqueId}. for good.`
                    );
                    console.log('----------------------');
                  } else {
                    console.error(getCurrentDate() + ` Error deleting ressource with name: ${uniqueId} immediately`);
                  }
                })
                .catch((error) => {
                  let message = getCurrentDate() + ` Error deleting ressource with name: ${uniqueId} for good.`;
                  //   console.log(error);
                  if (error && error.response && error.response.data && error.response.data.message) {
                    message += getCurrentDate() + `  Message from API: ${error.response.data.message}`;
                  }
                  console.error(message);
                });
            }, ASM_EP_DEL_WAIT_TIME_MS);
          }
        } else {
          console.error(getCurrentDate() + ` Error deleting ressource with name: ${uniqueId}. Response code gt 400`);
        }
      })
      .catch((error) => {
        const message = getCurrentDate() + ` Error deleting ressource with name: ${uniqueId}`;
        console.error(message);
        console.log(error);
      });
  }
}

async function deleteReferenceFromAsm(eleAsmId) {
  return new Promise(async function (resolve, reject) {
    console.log(getCurrentDate() + ` Deleting references from ressource with ASM id ${eleAsmId}`);
    try {
      axios
        .delete(ASM_TOPO_URL + ASM_EP_RES + '/' + encodeURIComponent(eleAsmId) + ASM_EP_REF_DEL, {
          timeout: 5000,
          headers: {
            Authorization: `Basic ${token}`,
            'X-TenantID': ASM_TENANT_ID,
          },
        })
        .then(
          (response) => {
            if (response.status && response.status >= 400) {
              console.error(
                getCurrentDate() +
                  ` Received an error response while deleting a reference from ASM. Ressource: ${eleAsmId}`
              );
              reject(`Received an error response while deleting a reference from ASM. Ressource: ${eleAsmId}`);
            } else {
              console.log(getCurrentDate() + ' Successfully deleted refernece from ASM.');
              resolve();
            }
          },
          (error) => {
            console.error(getCurrentDate() + ' Error deleting a reference from ASM:');
            console.log(error);
            if (error && error.response && error.response.data) {
              const errorData = error.response.data;
              if (errorData) {
                if (errorData.message) console.log(getCurrentDate() + ` Reason: ${errorData.message}`);
              }
            }
            reject('Error deleting a reference from ASM.');
          }
        );
    } catch (err) {
      console.log(getCurrentDate() + ' Caught an exception while deleting a reference from ASM.!');
      console.error(err);
      reject('Caught an exception while deleting a reference from ASM.!');
    }
  });
}
