export const calculateBalances = (expenses) => {
  const usersData = {};

  expenses.forEach(exp => {
    if (exp.status === 'pending' || exp.status === 'rejected') return;

    const amount = exp.amount;
    const paidBy = exp.paidBy._id ? exp.paidBy._id.toString() : exp.paidBy.toString();
    const splitType = exp.splitType || 'equal';

    if (!usersData[paidBy]) usersData[paidBy] = { totalPaid: 0, totalOwed: 0, netBalance: 0 };
    usersData[paidBy].totalPaid += amount;
    usersData[paidBy].netBalance += amount;

    if (splitType === 'exact' && exp.exactSplits && exp.exactSplits.length > 0) {
      exp.exactSplits.forEach(split => {
        const member = split.user._id ? split.user._id.toString() : split.user.toString();
        const splitAmount = split.amount;
        if (!usersData[member]) usersData[member] = { totalPaid: 0, totalOwed: 0, netBalance: 0 };
        usersData[member].totalOwed += splitAmount;
        usersData[member].netBalance -= splitAmount;
      });
    } else {
      const splitAmongIds = exp.splitAmong.map(m => m._id ? m._id.toString() : m.toString());
      const amountInCents = Math.round(amount * 100);
      const memberCount = splitAmongIds.length;
      const baseCents = Math.floor(amountInCents / memberCount);
      let remainderCents = amountInCents % memberCount;

      splitAmongIds.forEach(member => {
        let memberCents = baseCents;
        if (remainderCents > 0) {
          memberCents += 1;
          remainderCents -= 1;
        }
        const splitAmount = memberCents / 100;

        if (!usersData[member]) usersData[member] = { totalPaid: 0, totalOwed: 0, netBalance: 0 };
        usersData[member].totalOwed += splitAmount;
        usersData[member].netBalance -= splitAmount;
      });
    }
  });

  // Simplify Debts Algorithm
  const debtors = [];
  const creditors = [];
  
  Object.keys(usersData).forEach(userId => {
    usersData[userId].netBalance = Math.round(usersData[userId].netBalance * 100) / 100;
    const bal = usersData[userId].netBalance;
    if (bal < -0.01) debtors.push({ id: userId, amount: Math.abs(bal) });
    else if (bal > 0.01) creditors.push({ id: userId, amount: bal });
  });

  const simplifiedDebts = [];
  let d = 0, c = 0;

  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];
    
    const minAmount = Math.min(debtor.amount, creditor.amount);
    
    simplifiedDebts.push({
      from: debtor.id,
      to: creditor.id,
      amount: Math.round(minAmount * 100) / 100
    });
    
    debtor.amount -= minAmount;
    creditor.amount -= minAmount;
    
    if (debtor.amount <= 0.01) d++;
    if (creditor.amount <= 0.01) c++;
  }

  return { usersData, simplifiedDebts };
};
