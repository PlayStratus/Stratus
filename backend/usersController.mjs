import { getUserById, createUser } from './usersModel.mjs';

export const ControlGetUserById = async (req, res) => {              //find user based on ID. Will swap to email as it will likely become the Partition key
  const { id } = req.query;
  try {
    const item = await getUserById(id);
    res.status(200).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch item' });
  }
};

export const ControlCreateUser = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const newItem = await createUser(req.body);
    res.status(201).json(newItem);
  } catch (err) {
    console.error('Create item error:', err.message);
    res.status(400).json({ error: err.message });
  }
};