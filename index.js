var circuit = {};
var provingKey = {};
var witnessCalc = {};
const abi = JSON.parse(`[{"inputs":[{"internalType":"address","name":"_depositVerifierContractAddr","type":"address"},{"internalType":"address","name":"_withdrawVerifierContractAddr","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"uint256","name":"_commitment","type":"uint256"},{"internalType":"uint256","name":"_root","type":"uint256"},{"internalType":"uint256[2]","name":"a","type":"uint256[2]"},{"internalType":"uint256[2][2]","name":"b","type":"uint256[2][2]"},{"internalType":"uint256[2]","name":"c","type":"uint256[2]"}],"name":"deposit","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"getCommitments","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address payable","name":"_address","type":"address"},{"internalType":"uint256","name":"nullifier","type":"uint256"},{"internalType":"uint256[2]","name":"a","type":"uint256[2]"},{"internalType":"uint256[2][2]","name":"b","type":"uint256[2][2]"},{"internalType":"uint256[2]","name":"c","type":"uint256[2]"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"}]`);
const miksiAddress = "0x4cc45573481A2977fcC0b9DD9f8c710201B5a5cd";
let metamask = false;

document.getElementById("contractAddr").innerHTML=`<a href="https://goerli.etherscan.io/address/`+miksiAddress+`" target="_blank" title="Miksi Smart Contract Address">`+miksiAddress+`</a>`;

function println(...s) {
  let r = "";
  for (let i=0; i<s.length; i++) {
    r = r + " " + s[i];
  }
  console.log(r);
  document.getElementById("logs").innerHTML += r + "<br>";
  document.getElementById("logs").scrollTop = document.getElementById("logs").scrollHeight;
}
function printerr(...s) {
  // println(s);
  let r = "";
  for (let i=0; i<s.length; i++) {
    r = r + " " + s[i];
  }
  console.log(r);
  document.getElementById("logs").innerHTML += `<span style="color:red;">Error: ` + r + `</span><br>`;
  document.getElementById("logs").scrollTop = document.getElementById("logs").scrollHeight;
}

function loadCircuit(circuitname) {
  fetch("circuits-files/"+circuitname+"-proving_key.bin").then( (response) => {
    return response.arrayBuffer();
  }).then( (b) => {
    provingKey[circuitname] = b;
    println("proving_key loaded for", circuitname);
  });

  fetch("circuits-files/"+circuitname+".wasm").then( (response) => {
    return response.arrayBuffer();
  }).then( (b) => {
    witnessCalc[circuitname] = b;
    console.log("w", b);
    println("witnessCalc loaded for", circuitname);
  });
}

async function deposit(circuitname) {
  if (!metamask) {
    toastr.error("Please install/connect Metamask");
    return;
  }
  if (window.ethereum.networkVersion!='5') {
    toastr.warning("Please switch to Göerli");
    alert("Please switch to Göerli");
    return;
  }
  document.getElementById("depositRes").innerHTML = `
    Generating zkProof & making the deposit
  `;
  console.log("circuit:", circuitname);

  // TODO
  println("generate random secret & nullifier");
  const secret = miksi.randBigInt().toString();
  const nullifier = miksi.randBigInt().toString();
  console.log("S N", secret, nullifier);

  println("get commitments from the miksi Smart Contract");
  let res = await miksiContract.methods.getCommitments().call();
  console.log("res", res);
  const commitments = res[0];
  const key = res[2];
  console.log("commitments", commitments);
  console.log("key", key);
  // getCommitments from the tree

  // calculate witness
  println("rebuild the Merkle Tree & calculate witness for deposit");
  console.log(witnessCalc[circuitname]);
  const cw = await miksi.calcDepositWitness(witnessCalc[circuitname], secret, nullifier, commitments, key).catch((e) => {
    toastr.error(e);
    printerr(e);
  });

  const witness = cw.witness;
  const publicInputs = cw.publicInputs;
  console.log("w", witness);
  console.log("publicInputs", publicInputs);

  // generate proof
  console.log(provingKey[circuitname]);
  println("generate zkSNARK Groth16 proof for deposit");
  const start = new Date().getTime();
  const proof = await window.groth16GenProof(witness.buffer, provingKey[circuitname]);
  const end = new Date().getTime();
  const time = end - start;
  println("circuit " + circuitname + " took " + time + "ms to compute");
  console.log(proof);
  console.log("proof", JSON.stringify(proof));


  // send tx
  const accounts = await web3.eth.getAccounts();
  const sender = accounts[0];
  console.log("SENDER", sender);

  console.log("sc call data",
    publicInputs.commitment,
    publicInputs.root.toString(),
    [proof.pi_a[0], proof.pi_a[1]],
    [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]]
    ],
    [proof.pi_c[0], proof.pi_c[1]],
  );
  println("send publicInputs & zkProof to the miksi Smart Contract for the deposit");
  miksiContract.methods.deposit(
    publicInputs.commitment,
    publicInputs.root.toString(),
    [proof.pi_a[0], proof.pi_a[1]],
    [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]]
    ],
    [proof.pi_c[0], proof.pi_c[1]],
  ).send(
    {from: sender, value: 1000000000000000000},
    function(error, transactionHash){
      if (error!=undefined) {
        console.log(error);
        toastr.error(error);
        printerr(JSON.stringify(error));
      } else {
        let link = `<a href="https://goerli.etherscan.io/tx/`+transactionHash+`" target="_blank">
              https://goerli.etherscan.io/tx/`+transactionHash+`</a>`;
        println(link);
      }
    });

  // print secret & nullifier
  let jw = {
    secret: secret,
    nullifier: nullifier,
    key: key
  };
  console.log("jw", JSON.stringify(jw));
  document.getElementById("depositRes").innerHTML = `
  <b>Please store the secret data in a safe place:</b><br>
    <input class="form-control" onClick="this.select();" readonly value='`+JSON.stringify(jw)+`'>
    </input>
  `;
}

async function withdraw(circuitname) {
  if (!metamask) {
    toastr.error("Please install/connect Metamask");
    return;
  }
  if (window.ethereum.networkVersion!='5') {
    toastr.warning("Please switch to Göerli");
    alert("Please switch to Göerli");
    return;
  }
  document.getElementById("withdrawRes").innerHTML = `
    Generating zkProof & making the withdraw
  `;
  console.log("circuit:", circuitname);
  let jw;
  try {
  jw = JSON.parse(document.getElementById("jsonWithdraw").value);
  } catch(e) {
    toastr.error("Error reading secret & nullifier: " + e);
  }
  const secret = jw.secret;
  const nullifier = jw.nullifier;
  const key = jw.key;
  console.log(secret, nullifier);
  println("calculate commitment for the secret & nullifier");
  const commitment = miksi.calcCommitment(secret, nullifier);

  // getCommitments from the tree
  println("get commitments from the miksi Smart Contract");
  let res = await miksiContract.methods.getCommitments().call();
  console.log("res", res);
  const commitments = res[0];
  console.log("commitments", commitments);

  // calculate witness
  console.log(witnessCalc[circuitname]);
  const addr = document.getElementById("withdrawAddress").value;
  if (addr==undefined) {
    toastr.error("No withdraw address defined");
    return;
  }
  if (!web3.utils.isAddress(addr)) {
    toastr.error("Error with withdraw address");
    return;
  }
  println("rebuild the Merkle Tree & calculate witness for withdraw");
  const cw = await miksi.calcWithdrawWitness(witnessCalc[circuitname], secret, nullifier, commitments, addr, key).catch((e) => {
    toastr.error(e);
    printerr(e);
  });

  const witness = cw.witness;
  const publicInputs = cw.publicInputs;
  console.log("w", witness);
  console.log("publicInputs", publicInputs);

  // generate proof
  console.log(provingKey[circuitname]);
  println("generate zkSNARK Groth16 proof for withdraw");
  const start = new Date().getTime();
  const proof = await window.groth16GenProof(witness.buffer, provingKey[circuitname]);
  const end = new Date().getTime();
  const time = end - start;
  println("circuit " + circuitname + " took " + time + "ms to compute");
  console.log(proof);


  // send tx
  const accounts = await web3.eth.getAccounts();
  const sender = accounts[0];
  console.log("SENDER", sender);

  console.log("sc call data",
    publicInputs.address,
    publicInputs.nullifier,
    [proof.pi_a[0], proof.pi_a[1]],
    [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]]
    ],
    [proof.pi_c[0], proof.pi_c[1]],
  );
  println("send publicInputs & zkProof to the miksi Smart Contract for the withdraw");
  miksiContract.methods.withdraw(
    publicInputs.address,
    publicInputs.nullifier,
    [proof.pi_a[0], proof.pi_a[1]],
    [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]]
    ],
    [proof.pi_c[0], proof.pi_c[1]],
  ).send(
    {from: sender},
    function(error, transactionHash){
      if (error!=undefined) {
        console.log(error);
        toastr.error(error);
        printerr(JSON.stringify(error));
      } else {
        let link = `<a href="https://goerli.etherscan.io/tx/`+transactionHash+`" target="_blank">
              https://goerli.etherscan.io/tx/`+transactionHash+`</a>`;
        println(link);
      }
    });
}

loadCircuit("deposit");
loadCircuit("withdraw");




let miksiContract;

async function connectMetamask() {
  const ethEnabled = () => {
    if (window.web3) {
      window.web3 = new Web3(window.web3.currentProvider);
      window.ethereum.enable();
      return true;
    }
    return false;
  }

  if (!ethEnabled()) {
    toastr.warning("Please install Metamask to use miksi");
    alert("Please install MetaMask to use miksi");
    return;
  } else if (window.ethereum.networkVersion!='5') {
    toastr.warning("Please switch to Göerli");
    alert("Please switch to Göerli");
    return;
  } else {
    metamask = true;
  }

  console.log("abi", abi);
  miksiContract = new web3.eth.Contract(abi, miksiAddress);
  console.log("miksiContract", miksiContract);
  toastr.info("Metamask connected. Miksi contract: " + miksiAddress);
  println("Metamask connected. Miksi contract: ", miksiAddress);

  const acc = await web3.eth.getAccounts();
  const addr = acc[0];
  web3.eth.getBalance(addr, function(err, res){
    console.log("current address balance:", JSON.stringify(res));
  });
  const miksiBalance = await web3.eth.getBalance(miksiAddress);

  let html = "<b>miksi</b> Smart Contract current balance: " + miksiBalance/1000000000000000000 + " ETH<br>";
  let res = await miksiContract.methods.getCommitments().call();
  const commitments = res[0];
  const key = res[2];
  html += "number of commitments: " + commitments.length + "<br>";
  html += "current key: " + key + "<br>";
  document.getElementById("stats").innerHTML = html;

}
