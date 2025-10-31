import { dynamoDb } from './server.mjs';
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

export const getUserById = async (id) => {                   
  const params = {
    TableName: 'Users',
    Key: { UserID: id },                                            //needs to be Partition key
  };
  const result = await dynamoDb.send(new GetCommand(params));       //send to aws
  return result.Item;
};

export const createUser = async (item) => {                            
  const { UserID, Username, Email } = item;

  if (typeof UserID !== 'number' || !Username || !Email) {
    throw new Error('Invalid item format');
  }

  const params = {
    TableName: 'Users',
    Item: { UserID, Username, Email },
  };
  
  await dynamoDb.send(new PutCommand(params));                      //send to aws
  return params.Item;
};