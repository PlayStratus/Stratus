import { dynamoDb } from '../server.mjs';
import { PutCommand, GetCommand} from '@aws-sdk/lib-dynamodb';

export const ControllerGetUserById = async (req, res) => {              //find user based on ID. 
  const { id } = req.params;
  try {
    const user = await getUserById(id);
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

export const ControllerCreateUser = async (req, res) => {               //creates new user
  try { 
    const newUser = await createUser(req.body);
    res.status(201).json(newUser); 
  } 
  catch (err) { 
    console.error('Create item error:', err.message); 
    res.status(400).json({ error: err.message });
  } 
};

const createUser = async (user) => {                            
  const { UserID, Username, Email } = user;

  if (typeof UserID !== 'string' || !Username || !Email) {              //ToDo: make more thorough
    throw new Error('Invalid user format');
  }

  const checkParams = {                                                 //check if user already exists
    TableName: 'Users',
    Key: { UserID },
  };

  const existing = await dynamoDb.send(new GetCommand(checkParams));
  if (existing.Item) {
    throw new Error('User already exists');
  }

  const params = {                                                       //create new user
    TableName: 'Users',
    Item: { UserID, Username, Email },
  };
  
  await dynamoDb.send(new PutCommand(params));                           //send to aws
  return params.User;
};

const getUserById = async (id) => {                   
  const params = {
    TableName: 'Users',
    Key: { UserID: id },                                                //needs to be partition key
  };
  const result = await dynamoDb.send(new GetCommand(params));           //send to aws
  return result.Item;
};

